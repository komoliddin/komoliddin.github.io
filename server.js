const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const axios = require('axios');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' }));
app.use(express.static(__dirname));

const repoOwner = 'komoliddin';
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''; // Можно добавить токен в переменные окружения

// Функция для синхронизации с GitHub
async function syncGitHub() {
    console.log(`[${new Date().toLocaleTimeString()}] Начало синхронизации с GitHub...`);
    try {
        const headers = GITHUB_TOKEN ? { 'Authorization': `token ${GITHUB_TOKEN}` } : {};
        
        // 1. Получаем список репозиториев
        const reposRes = await axios.get(`https://api.github.com/users/${repoOwner}/repos?sort=updated&per_page=100`, { headers });
        const repos = reposRes.data;

        // Читаем текущие проекты
        const projectsPath = path.join(__dirname, 'projects.json');
        let projects = [];
        if (fs.existsSync(projectsPath)) {
            projects = JSON.parse(fs.readFileSync(projectsPath, 'utf8'));
        }

        // 2. Обновляем данные для каждого репозитория
        for (const r of repos) {
            let version = '1.0.0';
            let releases = [];
            
            try {
                // Пытаемся получить версию из version.txt
                const vRes = await axios.get(`https://raw.githubusercontent.com/${repoOwner}/${r.name}/${r.default_branch}/version.txt`, { timeout: 5000 }).catch(() => null);
                if (vRes && vRes.data) version = vRes.data.toString().trim();

                // Получаем список релизов
                const relRes = await axios.get(`https://api.github.com/repos/${repoOwner}/${r.name}/releases`, { headers, timeout: 5000 }).catch(() => null);
                if (relRes && relRes.data) releases = relRes.data;
            } catch (e) {
                // Игнорируем ошибки для отдельных репо
            }

            const existingIdx = projects.findIndex(p => p.name === r.name);
            const repoData = {
                id: r.id,
                name: r.name,
                category: 'GitHub Проекты',
                images: ['image/logo.png'],
                description: r.description || '',
                subcategories: [],
                is_active: true,
                is_github: true,
                stars: r.stargazers_count,
                language: r.language || 'Software',
                version: version,
                releases: releases // Сохраняем все релизы в JSON
            };

            if (existingIdx !== -1) {
                // Обновляем существующий, сохраняя кастомные поля (images, category, is_top и т.д.)
                projects[existingIdx] = {
                    ...projects[existingIdx],
                    stars: repoData.stars,
                    language: repoData.language,
                    version: repoData.version,
                    releases: repoData.releases,
                    description: projects[existingIdx].description || repoData.description
                };
            } else {
                projects.unshift(repoData);
            }
        }

        fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 4), 'utf8');
        console.log(`[${new Date().toLocaleTimeString()}] Синхронизация завершена успешно.`);
    } catch (error) {
        console.error(`[${new Date().toLocaleTimeString()}] Ошибка синхронизации:`, error.message);
    }
}

// Запуск синхронизации каждые 5 минут
setInterval(syncGitHub, 5 * 60 * 1000);
// Первый запуск при старте
syncGitHub();

app.post('/save-data', (req, res) => {
    const { filename, data } = req.body;
    const filePath = path.join(__dirname, filename);
    fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8', (err) => {
        if (err) return res.status(500).send('Error');
        console.log(`[${new Date().toLocaleTimeString()}] JSON ${filename} обновлен!`);
        res.send('OK');
    });
});

app.post('/upload-image', (req, res) => {
    try {
        const { name, data, project } = req.body;
        if (!project) return res.status(400).send('Project name is missing');

        const folderName = project.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const projectPath = path.join(__dirname, 'image', folderName);

        if (!fs.existsSync(projectPath)) {
            fs.mkdirSync(projectPath, { recursive: true });
        }

        const filePath = path.join(projectPath, name);
        const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
        const buffer = Buffer.from(base64Data, 'base64');

        fs.writeFile(filePath, buffer, (err) => {
            if (err) {
                console.error('Save error:', err);
                return res.status(500).send('Error saving to disk');
            }
            console.log(`[${new Date().toLocaleTimeString()}] Фото загружено: image/${folderName}/${name}`);
            res.send(`image/${folderName}/${name}`);
        });
    } catch (e) {
        console.error('Upload crash:', e);
        res.status(500).send('Server Error');
    }
});

app.listen(port, () => {
    console.log(`
    ====================================================
    СЕРВЕР СОХРАНЕНИЯ РАБОТАЕТ: http://localhost:3000
    ====================================================
    `);
});
