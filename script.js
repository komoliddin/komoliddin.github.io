const { createApp, ref, onMounted, computed, watch, nextTick } = Vue;

createApp({
    setup() {
        const repoOwner = 'komoliddin';
        const repoName = ref(new URLSearchParams(window.location.search).get('repo'));
        
        const products = ref([]);
        const categories = ref([]);
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
            const p = products.value.find(x => x.name === repoName.value);
            if (p && p.images && p.images.length > 0) return p.images;
            return ['image/logo.png'];
        });

        const showToast = (msg) => {
            const id = Date.now();
            toasts.value.push({ id, msg });
            setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 2500);
        };

        const myContacts = ref({ name: 'Komoliddin', phone: '', email: '', telegram: '', website: '' });
        const socialLinks = ref({ main: [], others: [] });
        const donateMethods = ref([]);

        // ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
        const githubProjects = computed(() => products.value.filter(p => p.is_github));

        const githubStats = computed(() => {
            const gh = githubProjects.value;
            const stars = gh.reduce((acc, p) => acc + (p.stars || 0), 0);
            const langs = gh.map(p => p.language).filter(l => l);
            const topLang = langs.length > 0 ? langs.sort((a,b) => langs.filter(v => v===a).length - langs.filter(v => v===b).length).pop() : 'Python';
            return { stars, topLang };
        });

        const currentSubcategories = computed(() => {
            if (selectedCategory.value === 'all' || selectedCategory.value === 'GitHub Проекты') return [];
            const cat = categories.value.find(c => c.name === selectedCategory.value);
            return cat ? (cat.subcategories || []) : [];
        });

        const loadData = async () => {
            loading.value = true;
            const v = Date.now();
            try {
                const conf = await fetch(`config.json?v=${v}`).then(r => r.ok ? r.json() : null).catch(() => null);
                if (conf) {
                    if (conf.myContacts) myContacts.value = conf.myContacts;
                    if (conf.socialLinks) socialLinks.value = conf.socialLinks;
                    if (conf.donateMethods) donateMethods.value = conf.donateMethods;
                    if (conf.publicStats) publicStats.value = conf.publicStats;
                }

                const [pRes, cRes] = await Promise.all([
                    fetch(`projects.json?v=${v}`).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`categories.json?v=${v}`).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);
                const localProjects = pRes.filter(p => p.is_active !== false);
                categories.value = cRes;

                const ghCacheKey = `gh_repos_${repoOwner}`;
                const cachedGh = localStorage.getItem(ghCacheKey);
                const cacheTime = localStorage.getItem(ghCacheKey + '_time');

                let repos = [];
                if (cachedGh && cacheTime && (Date.now() - cacheTime < 3600000)) {
                    repos = JSON.parse(cachedGh);
                } else {
                    const ghRes = await fetch(`https://api.github.com/users/${repoOwner}/repos?sort=updated&per_page=100`).catch(() => null);
                    if (ghRes && ghRes.ok) {
                        const raw = await ghRes.json();
                        repos = raw.map(r => ({
                            id: 'gh-' + r.id, name: r.name, description: r.description,
                            price: 0, images: ['image/logo.png'], category: 'GitHub Проекты',
                            stars: r.stargazers_count, language: r.language, is_github: true, html_url: r.html_url,
                            version: ''
                        }));
                        localStorage.setItem(ghCacheKey, JSON.stringify(repos));
                        localStorage.setItem(ghCacheKey + '_time', Date.now());
                    } else if (cachedGh) { repos = JSON.parse(cachedGh); }
                }

                const merged = repos.map(gh => {
                    const local = localProjects.find(p => p.name === gh.name);
                    return local ? { ...gh, ...local, is_github: true } : gh;
                });
                const ghNames = merged.map(g => g.name);
                const onlyLocal = localProjects.filter(p => !ghNames.includes(p.name));
                products.value = [...merged, ...onlyLocal];

                products.value.forEach(p => {
                    if (p.is_github && !p.version) fetchVersionFromTxt(p);
                });

            } catch (e) { console.error("Load error:", e); }
            finally { 
                loading.value = false;
                nextTick(() => { if(typeof AOS !== 'undefined') AOS.init({duration: 800, once: true}); });
            }
        };

        const fetchVersionFromTxt = async (p) => {
            const branches = ['main', 'master'];
            for (let b of branches) {
                try {
                    const res = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${p.name}/${b}/version.txt`);
                    if (res.ok) {
                        const ver = (await res.text()).trim();
                        if (ver) {
                            p.version = ver;
                            const ghCacheKey = `gh_repos_${repoOwner}`;
                            const cached = JSON.parse(localStorage.getItem(ghCacheKey) || '[]');
                            const target = cached.find(x => x.name === p.name);
                            if (target) { target.version = ver; localStorage.setItem(ghCacheKey, JSON.stringify(cached)); }
                            break;
                        }
                    }
                } catch (e) {}
            }
        };

        const fetchRepoInfo = async (name) => {
            loading.value = true;
            readmeHtml.value = ''; changelogText.value = ''; repoData.value = {}; latestRelease.value = null;
            const p = products.value.find(x => x.name === name);
            if (p) repoData.value = { ...p };
            if (p && p.is_github) {
                try {
                    const [relRes, infoRes] = await Promise.all([
                        fetch(`https://api.github.com/repos/${repoOwner}/${name}/releases/latest`),
                        fetch(`https://api.github.com/repos/${repoOwner}/${name}`)
                    ]);
                    if (infoRes.ok) repoData.value = { ...repoData.value, ...(await infoRes.json()) };
                    if (relRes.ok) {
                        const relData = await relRes.json();
                        latestRelease.value = relData;
                        if (!repoData.value.version) repoData.value.version = relData.tag_name;
                    }
                    const branches = ['main', 'master'];
                    for (let b of branches) {
                        const rdRes = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${name}/${b}/README.md`);
                        if (rdRes.ok) { readmeHtml.value = marked.parse(await rdRes.text()); break; }
                    }
                    const chRes = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${name}/master/changelog.txt`).then(r => r.ok ? r.text() : fetch(`https://raw.githubusercontent.com/${repoOwner}/${name}/main/changelog.txt`).then(r2 => r2.ok ? r2.text() : ''));
                    if (chRes) changelogText.value = chRes;
                } catch (e) { console.error(e); }
            }
            loading.value = false;
        };

        const filteredProducts = computed(() => {
            const q = searchQuery.value.toLowerCase();
            return products.value.filter(p => {
                const matchesSearch = (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
                let matchesCat = (selectedCategory.value === 'all') || (selectedCategory.value === 'GitHub Проекты' ? p.is_github : p.category === selectedCategory.value);
                const matchesSub = selectedSubcategory.value === 'all' || (p.subcategories && p.subcategories.includes(selectedSubcategory.value));
                return matchesSearch && matchesCat && matchesSub;
            });
        });

        const displayGroups = computed(() => {
            const groups = {};
            const all = filteredProducts.value;
            if (selectedCategory.value !== 'all' || searchQuery.value) {
                const title = selectedCategory.value === 'all' ? 'Результаты поиска' : selectedCategory.value;
                groups[title] = all;
                return groups;
            }
            const ghItems = all.filter(p => p.is_github);
            if (ghItems.length > 0) groups['GitHub Проекты'] = ghItems;
            all.forEach(p => {
                if (p.is_github) return;
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
            loadData().then(() => { if (repoName.value) fetchRepoInfo(repoName.value); });
            window.addEventListener('scroll', () => showTopButton.value = window.scrollY > 300);
            window.addEventListener('popstate', () => {
                const urlRepo = new URLSearchParams(window.location.search).get('repo');
                repoName.value = urlRepo;
                if (urlRepo) fetchRepoInfo(urlRepo);
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
                nextTick(() => { if(typeof AOS !== 'undefined') AOS.refreshHard(); });
            },
            applyTheme, 
            handleDonate: (m) => {
                if (m.url) window.open(m.url, '_blank');
                else navigator.clipboard.writeText(m.id).then(() => showToast(`Реквизиты ${m.name} скопированы!`));
            },
            scrollToTop: () => window.scrollTo({ top: 0, behavior: 'smooth' }),
            saveVCard: () => {
                const name = myContacts.value.name || 'Komoliddin';
                const phone = myContacts.value.phone || '';
                const email = myContacts.value.email || '';
                const site = myContacts.value.website || '';
                const tg = myContacts.value.telegram || '';
                const vcard = ['BEGIN:VCARD','VERSION:3.0',`FN:${name}`,`TEL;TYPE=CELL:${phone}`,`EMAIL;TYPE=INTERNET:${email}`,`URL:${site}`,`NOTE:Telegram: ${tg}`,'END:VCARD'].join('\n');
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([vcard], { type: "text/vcard" }));
                a.download = `${name}.vcf`;
                a.click();
            }
        };
    }
}).mount('#app');
