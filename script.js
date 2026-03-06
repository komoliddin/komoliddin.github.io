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
            const p = products.value.find(x => x.name === repoName.value);
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
                { name: 'Instagram', url: '#', icon: 'fab fa-instagram', color: '#E1306C' },
                { name: 'Odnoklassniki', url: '#', icon: 'fab fa-odnoklassniki', color: '#EE8208' },
                { name: 'Skype', url: '#', icon: 'fab fa-skype', color: '#00AFF0' },
                { name: 'Twitter', url: '#', icon: 'fab fa-twitter', color: '#1DA1F2' },
                { name: 'Viber', url: '#', icon: 'fab fa-viber', color: '#665CAC' },
                { name: 'VKontakte', url: '#', icon: 'fab fa-vk', color: '#4C75A3' },
                { name: 'WhatsApp', url: '#', icon: 'fab fa-whatsapp', color: '#25D366' }
            ],
            others: [
                { name: 'Discord', url: '#', icon: 'fab fa-discord', color: '#5865F2' },
                { name: 'GitHub', url: 'https://github.com/komoliddin', icon: 'fab fa-github', color: '#fff' },
                { name: 'Steam', url: '#', icon: 'fab fa-steam', color: '#000000' },
                { name: 'Twitch', url: '#', icon: 'fab fa-twitch', color: '#9146FF' }
            ]
        });

        const donateMethods = ref([
            { url: 'https://tirikchilik.uz/komoliddin', name: 'Uzcard, Humo, Click, Payme, Uzum', icon: 'uzcard.png', desc: 'Перейти к оплате' },
            { id: '4100116824448677', name: 'ЮMoney', icon: 'yoomoney_yandex.png', desc: '4100 1168 2444 8677' },
            { id: '1HuJa7E3TcQKrF7BYXgeGp3AwpzY2ZArgU', name: 'Bitcoin', icon: 'btc.png', desc: 'Bitcoin Network' },
            { id: '0xdc61c5123db3110456d6ae61efdfa67521fb274b', name: 'Ethereum', icon: 'eth.png', desc: 'ERC-20' },
            { id: 'UQAamz0zAXm_Drr5KjyUdsTj6UMlRaJzntaAGjv6_JMrexZy', name: 'Toncoin', icon: 'ton.png', desc: 'Network: TON' },
            { id: 'UQAamz0zAXm_Drr5KjyUdsTj6UMlRaJzntaAGjv6_JMrexZy', name: 'Notcoin', icon: 'not.png', desc: 'Network: TON' },
            { id: 'TQuGzNYXriigmbbkWmCJFaYvFRTshM6hbd', name: 'USDT (Tether)', icon: 'usdt-tether.png', desc: 'TRC-20' }
        ]);

        const githubStats = computed(() => {
            const stars = githubProjects.value.reduce((acc, p) => acc + p.stars, 0);
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
            try {
                const conf = await fetch('config.json').then(r => r.ok ? r.json() : null).catch(() => null);
                if (conf) {
                    if (conf.myContacts) myContacts.value = conf.myContacts;
                    if (conf.socialLinks) socialLinks.value = conf.socialLinks;
                    if (conf.donateMethods) donateMethods.value = conf.donateMethods;
                    if (conf.publicStats) publicStats.value = conf.publicStats;
                }
                const [pRes, cRes] = await Promise.all([
                    fetch('projects.json').then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch('categories.json').then(r => r.ok ? r.json() : []).catch(() => [])
                ]);
                products.value = pRes.filter(p => p.is_active !== false);
                categories.value = cRes;

                const ghCacheKey = `gh_repos_${repoOwner}`;
                const cachedGh = localStorage.getItem(ghCacheKey);
                const cacheTime = localStorage.getItem(ghCacheKey + '_time');

                if (cachedGh && cacheTime && (Date.now() - cacheTime < 3600000)) {
                    githubProjects.value = JSON.parse(cachedGh);
                } else {
                    const ghRes = await fetch(`https://api.github.com/users/${repoOwner}/repos?sort=updated&per_page=100`).catch(() => null);
                    if (ghRes && ghRes.ok) {
                        const repos = await ghRes.json();
                        githubProjects.value = repos.map(r => ({
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
                        localStorage.setItem(ghCacheKey, JSON.stringify(githubProjects.value));
                        localStorage.setItem(ghCacheKey + '_time', Date.now());
                    }
                }
            } catch (e) { console.error("Data load error:", e); }
            finally { 
                loading.value = false;
                setTimeout(() => { if(typeof AOS !== 'undefined') AOS.init({duration: 800, once: true}); }, 100);
            }
        };

        const fetchRepoInfo = async (name) => {
            loading.value = true;
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
                    const localP = products.value.find(p => p.name === name);
                    repoData.value = localP ? { ...data, ...localP } : data;
                }
                if (rdRes.ok) readmeHtml.value = marked.parse(await rdRes.text());
                if (relRes.ok) latestRelease.value = await relRes.json();
                if (chRes) changelogText.value = chRes;
            } catch (e) { console.error(e); }
            finally { loading.value = false; }
        };

        const filteredProducts = computed(() => {
            const all = [...products.value, ...githubProjects.value];
            const q = searchQuery.value.toLowerCase();
            return all.filter(p => {
                const matchesSearch = (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q);
                const matchesCat = selectedCategory.value === 'all' || p.category === selectedCategory.value;
                const matchesSub = selectedSubcategory.value === 'all' || (p.subcategories && p.subcategories.includes(selectedSubcategory.value));
                return matchesSearch && matchesCat && matchesSub;
            });
        });

        const displayGroups = computed(() => {
            const groups = {};
            const all = filteredProducts.value.slice(0, 100);
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
