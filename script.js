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
        const previewIndex = ref(0);
        const topCarouselIndex = ref(0);
        const isMobile = ref(window.innerWidth <= 768);
        const isTransitioning = ref(true);
        let carouselTimer = null;

        window.addEventListener('resize', () => { isMobile.value = window.innerWidth <= 768; });

        const startCarousel = () => {
            stopCarousel();
            carouselTimer = setInterval(nextTop, 5000);
        };

        const stopCarousel = () => {
            if (carouselTimer) clearInterval(carouselTimer);
        };

        const topProductsLoop = computed(() => {
            if (topProducts.value.length === 0) return [];
            // Клонируем элементы для бесконечного цикла (2 для десктопа, чтобы не было дыр)
            return [...topProducts.value, ...topProducts.value.slice(0, 2)];
        });

        const sliderTransform = computed(() => {
            const step = isMobile.value ? 100 : 50;
            return `translateX(-${topCarouselIndex.value * step}%)`;
        });

        const nextTop = () => {
            if (topProducts.value.length <= 1) return;
            isTransitioning.value = true;
            topCarouselIndex.value++;

            if (topCarouselIndex.value >= topProducts.value.length) {
                setTimeout(() => {
                    isTransitioning.value = false;
                    topCarouselIndex.value = 0;
                }, 600);
            }
            startCarousel(); // Сбрасываем таймер при ручном переключении
        };

        const prevTop = () => {
            if (topProducts.value.length <= 1) return;
            if (topCarouselIndex.value === 0) {
                isTransitioning.value = false;
                topCarouselIndex.value = topProducts.value.length;
                setTimeout(() => {
                    isTransitioning.value = true;
                    topCarouselIndex.value--;
                }, 10);
            } else {
                isTransitioning.value = true;
                topCarouselIndex.value--;
            }
            startCarousel(); // Сбрасываем таймер
        };

        const publicStats = ref({ orders_total: 0, users_total: 0, orders_delivered: 0, reviews_total: 0 });

        const projectImages = computed(() => {
            if (!repoName.value) return ['image/logo.png'];
            const p = products.value.find(x => x.name === repoName.value);
            if (p && p.images && p.images.length > 0) return p.images;
            return ['image/logo.png'];
        });

        const openPreview = (img) => {
            const idx = projectImages.value.indexOf(img);
            previewIndex.value = idx !== -1 ? idx : 0;
            const el = document.getElementById('imagePreviewModal');
            if (el && typeof bootstrap !== 'undefined') {
                const m = bootstrap.Modal.getOrCreateInstance(el);
                m.show();
                window.addEventListener('keydown', handleKeyNavigation);
            }
        };

        const closePreview = () => {
            const el = document.getElementById('imagePreviewModal');
            if (el) {
                const m = bootstrap.Modal.getOrCreateInstance(el);
                m.hide();
                window.removeEventListener('keydown', handleKeyNavigation);
            }
        };

        const nextImage = () => {
            previewIndex.value = (previewIndex.value + 1) % projectImages.value.length;
        };

        const prevImage = () => {
            previewIndex.value = (previewIndex.value - 1 + projectImages.value.length) % projectImages.value.length;
        };

        const handleKeyNavigation = (e) => {
            if (e.key === 'ArrowRight') nextImage();
            if (e.key === 'ArrowLeft') prevImage();
            if (e.key === 'Escape') closePreview();
        };

        // Глобальные хоткеи
        window.addEventListener('keydown', (e) => {
            // Нажатие '/' для фокуса на поиске (если не в поле ввода)
            if (e.key === '/' && document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                e.preventDefault();
                const searchInput = document.querySelector('.search-container input');
                if (searchInput) searchInput.focus();
            }
            // Esc для выхода на главную
            if (e.key === 'Escape' && repoName.value && !document.getElementById('imagePreviewModal').classList.contains('show')) {
                goHome();
            }
        });

        const showToast = (msg) => {
            const id = Date.now();
            toasts.value.push({ id, msg });
            setTimeout(() => { toasts.value = toasts.value.filter(t => t.id !== id); }, 2500);
        };

        const myContacts = ref({ name: 'Komoliddin', phone: '', email: '', telegram: '', website: '' });
        const modalTitles = ref({ donate: '꧁Donate꧂', socials: '꧁Социальные сети꧂' });
        const modalInfo = ref({ donate: '', socials: '' });
        const socialLinks = ref([]);
        const donateMethods = ref([]);

        // ВЫЧИСЛЯЕМЫЕ СВОЙСТВА
        const topProducts = computed(() => products.value.filter(p => p.is_top).sort((a, b) => a.name.localeCompare(b.name)));
        
        const githubProjects = computed(() => products.value.filter(p => p.is_github));

        const githubStats = computed(() => {
            const gh = githubProjects.value;
            const stars = gh.reduce((acc, p) => acc + (p.stars || 0), 0);
            const langs = gh.map(p => p.language).filter(l => l);
            const topLang = langs.length > 0 ? langs.sort((a, b) => langs.filter(v => v === a).length - langs.filter(v => v === b).length).pop() : 'Python';
            return { stars, topLang };
        });

        const currentSubcategories = computed(() => {
            if (selectedCategory.value === 'all' || selectedCategory.value === 'GitHub Проекты') return [];
            const cat = categories.value.find(c => c.name === selectedCategory.value);
            return cat ? (cat.subcategories || []) : [];
        });

        const donateGroups = computed(() => {
            const groups = {};
            donateMethods.value.forEach(m => {
                const s = m.size || 1;
                if (!groups[s]) groups[s] = [];
                groups[s].push(m);
            });
            return Object.keys(groups).sort((a, b) => a - b).map(k => groups[k]);
        });

        const socialGroups = computed(() => {
            const groups = {};
            socialLinks.value.forEach(s => {
                const sz = s.size || 1;
                if (!groups[sz]) groups[sz] = [];
                groups[sz].push(s);
            });
            return Object.keys(groups).sort((a, b) => a - b).map(k => groups[k]);
        });

        const loadData = async () => {
            loading.value = true;
            const v = Date.now();
            try {
                const conf = await fetch(`config.json?v=${v}`).then(r => r.ok ? r.json() : null).catch(() => null);
                if (conf) {
                    if (conf.myContacts) myContacts.value = conf.myContacts;
                    if (conf.modalTitles) modalTitles.value = conf.modalTitles;
                    if (conf.modalInfo) modalInfo.value = conf.modalInfo;
                    if (conf.socialLinks) {
                        socialLinks.value = conf.socialLinks.map(s => ({ ...s, uid: Math.random().toString(36).substr(2, 9) }));
                    }
                    if (conf.donateMethods) {
                        donateMethods.value = conf.donateMethods.map(m => ({ ...m, uid: Math.random().toString(36).substr(2, 9) }));
                    }
                    if (conf.publicStats) publicStats.value = conf.publicStats;
                }

                const [pRes, cRes] = await Promise.all([
                    fetch(`projects.json?v=${v}`).then(r => r.ok ? r.json() : []).catch(() => []),
                    fetch(`categories.json?v=${v}`).then(r => r.ok ? r.json() : []).catch(() => [])
                ]);
                
                products.value = pRes.filter(p => p.is_active !== false);
                categories.value = cRes;

                // ФОНОВАЯ ЗАГРУЗКА ВЕРСИЙ И README ДЛЯ ГИТХАБА (ЧТОБЫ БЫЛО ВИДНО В КАРТОЧКАХ И КАРУСЕЛИ)
                products.value.forEach(async (p) => {
                    if (p.is_github) {
                        try {
                            const v = Date.now();
                            const branches = ['main', 'master'];
                            let activeBranch = null;

                            for (let b of branches) {
                                const vRes = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${p.name}/${b}/version.txt?v=${v}`);
                                if (vRes.ok) {
                                    p.version = (await vRes.text()).trim();
                                    activeBranch = b;
                                    break;
                                }
                            }

                            // Если это ТОП проект, подгружаем кусок README для карусели
                            if (p.is_top) {
                                if (!activeBranch) {
                                    for (let b of branches) {
                                        const check = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${p.name}/${b}/README.md?v=${v}`, { method: 'HEAD' });
                                        if (check.ok) { activeBranch = b; break; }
                                    }
                                }
                                if (activeBranch) {
                                    const rRes = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${p.name}/${activeBranch}/README.md?v=${v}`);
                                    if (rRes.ok) {
                                        const text = await rRes.text();
                                        // Очистка Markdown: убираем заголовки, картинки, ссылки, жирный текст и коды
                                        p.description = text
                                            .replace(/#+\s+.*/g, '') // Заголовки
                                            .replace(/!\[.*?\]\(.*?\)/g, '') // Картинки
                                            .replace(/\[(.*?)\]\(.*?\)/g, '$1') // Ссылки (оставляем только текст)
                                            .replace(/[`*_~]/g, '') // Спецсимволы разметки
                                            .replace(/<[^>]*>/g, '') // HTML теги
                                            .replace(/\s+/g, ' ') // Лишние пробелы
                                            .trim()
                                            .substring(0, 180) + '...';
                                    }
                                }
                            }
                        } catch (e) {}
                    }
                });

            } catch (e) { console.error("Load error:", e); }
            finally {
                loading.value = false;
                nextTick(() => { if (typeof AOS !== 'undefined') AOS.init({ duration: 800, once: true }); });
            }
        };

        const fetchRepoInfo = async (name) => {
            loading.value = true;
            readmeHtml.value = ''; changelogText.value = ''; repoData.value = {}; latestRelease.value = null;
            const p = products.value.find(x => x.name === name);
            if (p) {
                repoData.value = { ...p };
                if (p.is_github && !repoData.value.html_url) {
                    repoData.value.html_url = `https://github.com/${repoOwner}/${name}`;
                }
            }
            
            if (p && p.is_github) {
                try {
                    const v = Date.now();
                    const branches = ['main', 'master'];
                    let activeBranch = 'main';

                    // 1. Пытаемся найти активную ветку и README
                    for (let b of branches) {
                        const rdRes = await fetch(`https://raw.githubusercontent.com/${repoOwner}/${name}/${b}/README.md?v=${v}`);
                        if (rdRes.ok) { 
                            readmeHtml.value = marked.parse(await rdRes.text()); 
                            activeBranch = b;
                            break; 
                        }
                    }
                    
                    // 2. Параллельно загружаем версию и ченджлог из найденной ветки
                    const [vRes, chRes] = await Promise.all([
                        fetch(`https://raw.githubusercontent.com/${repoOwner}/${name}/${activeBranch}/version.txt?v=${v}`).then(r => r.ok ? r.text() : null),
                        fetch(`https://raw.githubusercontent.com/${repoOwner}/${name}/${activeBranch}/changelog.txt?v=${v}`).then(r => r.ok ? r.text() : null)
                    ]);

                    if (vRes) repoData.value.version = vRes.trim();
                    if (chRes) changelogText.value = chRes;
                    
                    // 3. Fallback на API только для релизов, если нет прямой ссылки
                    if (!p.download_url) {
                         const relRes = await fetch(`https://api.github.com/repos/${repoOwner}/${name}/releases/latest`);
                         if (relRes.ok) {
                             const relData = await relRes.json();
                             latestRelease.value = relData;
                             if (!repoData.value.version) repoData.value.version = relData.tag_name;
                         }
                    }
                } catch (e) { console.error("Repo fetch error:", e); }
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

        const openModalById = (type) => {
            const id = type === 'donate' ? 'donateModal' :
                type === 'socials' ? 'socialsModal' :
                    type === 'contacts' ? 'contactsModal' : null;
            if (id) {
                const el = document.getElementById(id);
                if (el && typeof bootstrap !== 'undefined') {
                    const m = bootstrap.Modal.getOrCreateInstance(el);
                    m.show();
                } else {
                    setTimeout(() => openModalById(type), 300); // Пробуем еще раз через 300мс
                }
            }
        };

        onMounted(() => {
            applyTheme(themeMode.value);
            loadData().then(() => {
                if (repoName.value) fetchRepoInfo(repoName.value);

                // Проверка модалки при первой загрузке ПОСЛЕ загрузки данных
                const startModal = new URLSearchParams(window.location.search).get('modal');
                if (startModal) openModalById(startModal);
            });

            // Автопрокрутка ТОП-проектов
            startCarousel();

            window.addEventListener('scroll', () => showTopButton.value = window.scrollY > 300);
            window.addEventListener('popstate', () => {
                const params = new URLSearchParams(window.location.search);
                const urlRepo = params.get('repo');
                repoName.value = urlRepo;
                if (urlRepo) fetchRepoInfo(urlRepo);

                const mType = params.get('modal');
                if (mType) openModalById(mType);
            });
        });

        watch(selectedCategory, () => { selectedSubcategory.value = 'all'; });

        // УЛУЧШЕНИЕ: Кнопки копирования для блоков кода
        watch(readmeHtml, () => {
            nextTick(() => {
                const container = document.querySelector('.readme-container');
                if (!container) return;
                
                container.querySelectorAll('pre').forEach(pre => {
                    if (pre.querySelector('.code-copy-btn')) return; // Уже есть
                    
                    pre.style.position = 'relative';
                    const btn = document.createElement('button');
                    btn.className = 'code-copy-btn';
                    btn.innerText = 'Copy';
                    
                    btn.onclick = () => {
                        const code = pre.querySelector('code') ? pre.querySelector('code').innerText : pre.innerText;
                        navigator.clipboard.writeText(code).then(() => {
                            btn.innerText = 'Copied!';
                            setTimeout(() => btn.innerText = 'Copy', 2000);
                        });
                    };
                    
                    pre.appendChild(btn);
                });
            });
        });

        const updateMetaTags = (title, desc, img) => {
            document.title = title || 'PRO Projects — Portfolio';
            const setMeta = (query, val) => {
                const el = document.querySelector(query);
                if (el) el.setAttribute('content', val);
            };
            setMeta('meta[name="description"]', desc || 'Витрина моих лучших программных продуктов.');
            setMeta('meta[property="og:title"]', title || 'PRO Projects');
            setMeta('meta[property="og:description"]', desc || 'Витрина программных продуктов.');
            setMeta('meta[property="og:image"]', img || 'image/logo.png');
        };

        return {
            repoOwner, repoName, products, categories, githubProjects, topProducts, topProductsLoop, topCarouselIndex, sliderTransform, isTransitioning, nextTop, prevTop, repoData, readmeHtml, changelogText, latestRelease,
            loading, searchQuery, selectedCategory, selectedSubcategory, currentSubcategories, themeMode, donateMethods, socialLinks, myContacts, modalTitles, modalInfo,
            filteredProducts, displayGroups, showTopButton, publicStats, githubStats, toasts, projectImages, previewIndex, openPreview, closePreview, nextImage, prevImage,
            goToProject: (n) => {
                const u = new URL(window.location); u.searchParams.set('repo', n);
                window.history.pushState({}, '', u); repoName.value = n; fetchRepoInfo(n); window.scrollTo(0, 0);
                const p = products.value.find(x => x.name === n);
                if (p) updateMetaTags(`${n} — PRO Projects`, p.description, p.images[0]);
            },
            goHome: () => {
                const u = new URL(window.location); u.searchParams.delete('repo');
                window.history.pushState({}, '', u);
                repoName.value = null; searchQuery.value = ''; selectedCategory.value = 'all'; selectedSubcategory.value = 'all';
                nextTick(() => { if (typeof AOS !== 'undefined') AOS.refreshHard(); });
                updateMetaTags();
            },
            applyTheme,
            startCarousel,
            stopCarousel,
            donateGroups,
            socialGroups,
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
                const vcard = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${name}`, `TEL;TYPE=CELL:${phone}`, `EMAIL;TYPE=INTERNET:${email}`, `URL:${site}`, `NOTE:Telegram: ${tg}`, 'END:VCARD'].join('\n');
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([vcard], { type: "text/vcard" }));
                a.download = `${name}.vcf`;
                a.click();
            },
            shareProject: () => {
                navigator.clipboard.writeText(window.location.href).then(() => showToast('Ссылка скопирована!'));
            }
        };
    }
}).mount('#app');
