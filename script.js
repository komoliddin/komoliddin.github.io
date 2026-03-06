const { createApp, ref, onMounted, computed, watch } = Vue;

createApp({
    setup() {
        const repoOwner = 'komoliddin';
        const repoName = ref(new URLSearchParams(window.location.search).get('repo'));
        
        const products = ref([]);
        const categories = ref([]);
        const githubProjects = ref([]);
        const repoData = ref({});
        const readmeHtml = ref('');
        const changelogText = ref('');
        const latestRelease = ref(null);
        
        const loading = ref(true);
        const searchQuery = ref('');
        const selectedCategory = ref('all');
        const selectedSubcategory = ref('all');
        const themeMode = ref(localStorage.getItem('theme_mode') || 'auto');
        const showTopButton = ref(false);
        const toasts = ref([]);

        const publicStats = ref({ orders_total: 0, users_total: 0, orders_delivered: 0, reviews_total: 0 });

        const projectImages = computed(() => {
            if (!repoName.value) return ['image/logo.png'];
            const p = products.value.find(x => x.name === repoName.value) || githubProjects.value.find(x => x.name === repoName.value);
            if (p && p.images && p.images.length > 0) return p.images;
            return ['image/logo.png'];
        });

        const showToast = (msg) => {
            const id = Date.now();
            toasts.value.push({ id, msg });
            setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 2500);
        };

        const myContacts = ref({ name: 'Komoliddin', phone: '+998000000000', email: 'your_email@example.com', telegram: 'https://t.me/your_username', website: 'http://RePack.Moy.su' });

        const socialLinks = ref({
            main: [
                { name: 'Facebook', url: '#', icon: 'fab fa-facebook', color: '#1877F2' },
                { name: 'Instagram', url: '#', icon: 'fab fa-instagram', color: '#E1306C' }
            ],
            others: []
        });

        const donateMethods = ref([]);

        const githubStats = computed(() => {
            const stars = githubProjects.value.reduce((acc, p) => acc + (p.stars || 0), 0);
            const langs = githubProjects.value.map(p => p.language).filter(l => l);
            const topLang = langs.length > 0 ? langs.sort((a,b) => langs.filter(v => v===a).length - langs.filter(v => v===b).length).pop() : 'Python';
            return { stars, topLang };
        });

        const currentSubcategories = computed(() => {
            if (selectedCategory.value === 'all') return [];
            const cat = categories.value.find(c => c.name === selectedCategory.value);
            return cat ? (cat.subcategories || []) : [];
        });

        const loadData = async () => {
            loading.value = true;
            const v = Date.now();
            try {
                // 1. Загрузка конфига
                const conf = await fetch(`config.json?v=${v}`).then(r => r.ok ? r.json() : null).catch(() => null);
                if (conf) {
                    if (conf.myContacts) myContacts.value = conf.myContacts;
                    if (conf.socialLinks) socialLinks.value = conf.socialLinks;
                    if (conf.donateMethods) donateMethods.value = conf.donateMethods;
                    if (conf.publicStats) publicStats.value = conf.publicStats;
                }

                // 2. Загрузка локальных проектов и категорий
                const [pRes, cRes] = await Promise.all([
                    fetch(`projects.json?v=${v}`).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`categories.json?v=${v}`).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);
                products.value = pRes.filter(p => p.is_active !== false);
                categories.value = cRes;

                // 3. Загрузка GitHub (с кэшированием)
                const ghCacheKey = `gh_repos_${repoOwner}`;
                const cachedGh = localStorage.getItem(ghCacheKey);
                const cacheTime = localStorage.getItem(ghCacheKey + '_time');

                let repos = [];
                if (cachedGh && cacheTime && (Date.now() - cacheTime < 3600000)) {
                    repos = JSON.parse(cachedGh);
                } else {
                    const ghRes = await fetch(`https://api.github.com/users/${repoOwner}/repos?sort=updated&per_page=100`).catch(() => null);
                    if (ghRes && ghRes.ok) {
                        const rawRepos = await ghRes.json();
                        repos = rawRepos.map(r => ({
                            id: 'gh-' + r.id,
                            name: r.name,
                            description: r.description,
                            price: 0,
                            images: ['image/logo.png'],
                            category: 'GitHub Проекты',
                            stars: r.stargazers_count,
                            language: r.language,
                            is_github: true
                        }));
                        localStorage.setItem(ghCacheKey, JSON.stringify(repos));
                        localStorage.setItem(ghCacheKey + '_time', Date.now());
                    } else if (cachedGh) {
                        repos = JSON.parse(cachedGh); // Если API упал, но есть старый кэш - берем его
                    }
                }

                // 4. Объединение данных
                githubProjects.value = repos.map(gh => {
                    const local = products.value.find(p => p.name === gh.name);
                    if (local) {
                        return { 
                            ...gh, 
                            images: local.images && local.images.length > 0 ? local.images : gh.images,
                            price: local.price || 0,
                            old_price: local.old_price || 0,
                            is_recommended: local.is_recommended || false,
                            subcategories: local.subcategories || []
                        };
                    }
                    return gh;
                });

                // Убираем локальные копии, если есть GitHub оригинал
                const ghNames = githubProjects.value.map(g => g.name);
                products.value = products.value.filter(p => !ghNames.includes(p.name));

            } catch (e) { console.error("Load error:", e); }
            finally { 
                loading.value = false;
                setTimeout(() => { if(typeof AOS !== 'undefined') AOS.init({duration: 800, once: true}); }, 100);
            }
        };

        const fetchRepoInfo = async (name) => {
            loading.value = true;
            readmeHtml.value = '';
            changelogText.value = '';
            try {
                const [rRes, rdRes, relRes, chRes] = await Promise.all([
                    fetch(`https://api.github.com/repos/${repoOwner}/${name}`),
                    fetch(`https://api.github.com/repos/${repoOwner}/${name}/readme`, { headers: { 'Accept': 'application/vnd.github.v3.raw' } }),
                    fetch(`https://api.github.com/repos/${repoOwner}/${name}/releases/latest`),
                    fetch(`https://raw.githubusercontent.com/${repoOwner}/${name}/master/changelog.txt`).then(r => r.ok ? r.text() : fetch(`https://raw.githubusercontent.com/${repoOwner}/${name}/main/changelog.txt`).then(r2 => r2.ok ? r2.text() : ''))
                ]);
                if (rRes.ok) {
                    const data = await rRes.json();
                    const localP = githubProjects.value.find(p => p.name === name) || products.value.find(p => p.name === name);
                    repoData.value = localP ? { ...data, ...localP } : data;
                }
                if (rdRes.ok) readmeHtml.value = marked.parse(await rdRes.text());
                if (relRes.ok) latestRelease.value = await relRes.json();
                if (chRes) changelogText.value = chRes;
            } catch (e) { console.error(e); }
            finally { loading.value = false; }
        };

        const filteredProducts = computed(() => {
            const all = [...githubProjects.value, ...products.value];
            const q = searchQuery.value.toLowerCase();
            return all.filter(p => {
                const name = (p.name || '').toLowerCase();
                const desc = (p.description || '').toLowerCase();
                const matchesSearch = name.includes(q) || desc.includes(q);
                const matchesCat = selectedCategory.value === 'all' || p.category === selectedCategory.value;
                const matchesSub = selectedSubcategory.value === 'all' || (p.subcategories && p.subcategories.includes(selectedSubcategory.value));
                return matchesSearch && matchesCat && matchesSub;
            });
        });

        const displayGroups = computed(() => {
            const groups = {};
            const all = filteredProducts.value;
            const ghItems = all.filter(p => p.category === 'GitHub Проекты');
            if (ghItems.length > 0) groups['GitHub Проекты'] = ghItems;
            all.forEach(p => {
                if (p.category === 'GitHub Проекты') return;
                const c = p.category || 'Прочее';
                if (!groups[c]) groups[c] = [];
                groups[c].push(p);
            });
            return groups;
        });

        const applyTheme = (mode) => {
            let t = mode;
            if (mode === 'auto') t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            document.documentElement.setAttribute('data-theme', t);
            localStorage.setItem('theme_mode', mode);
            themeMode.value = mode;
        };

        onMounted(() => {
            applyTheme(themeMode.value);
            loadData();
            if (repoName.value) fetchRepoInfo(repoName.value);
            window.addEventListener('scroll', () => showTopButton.value = window.scrollY > 300);
            window.addEventListener('popstate', () => {
                repoName.value = new URLSearchParams(window.location.search).get('repo');
                if (repoName.value) fetchRepoInfo(repoName.value);
                else goHome();
            });
        });

        watch(selectedCategory, () => { selectedSubcategory.value = 'all'; });

        return {
            repoOwner, repoName, products, categories, githubProjects, repoData, readmeHtml, changelogText, latestRelease,
            loading, searchQuery, selectedCategory, selectedSubcategory, currentSubcategories, themeMode, donateMethods, socialLinks, myContacts,
            filteredProducts, displayGroups, showTopButton, publicStats, githubStats, toasts, projectImages,
            goToProject: (n) => {
                const u = new URL(window.location); u.searchParams.set('repo', n);
                window.history.pushState({}, '', u); repoName.value = n; fetchRepoInfo(n); window.scrollTo(0,0);
            },
            goHome: () => {
                const u = new URL(window.location); u.searchParams.delete('repo');
                window.history.pushState({}, '', u); 
                repoName.value = null; searchQuery.value = ''; selectedCategory.value = 'all'; selectedSubcategory.value = 'all';
                setTimeout(() => { if(typeof AOS !== 'undefined') AOS.refreshHard(); }, 100);
            },
            applyTheme, 
            handleDonate: (m) => {
                if (m.url) window.open(m.url, '_blank');
                else navigator.clipboard.writeText(m.id).then(() => showToast(`Реквизиты ${m.name} скопированы!`));
            },
            scrollToTop: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
            saveVCard: () => {
                const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${myContacts.value.name}\nTEL:${myContacts.value.phone}\nEND:VCARD`;
                const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([vcard], { type: "text/vcard" }));
                a.download = "contact.vcf"; a.click();
            }
        };
    }
}).mount('#app');
