const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Сохранение JSON данных
app.post('/save-data', (req, res) => {
    const { filename, data } = req.body;
    const filePath = path.join(__dirname, filename);
    fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8', (err) => {
        if (err) return res.status(500).send('Error');
        console.log(`[${new Date().toLocaleTimeString()}] Файл ${filename} обновлен!`);
        res.send('OK');
    });
});

// Сохранение изображений в подпапки проектов
app.post('/upload-image', (req, res) => {
    const { name, data, project } = req.body;
    
    // Очищаем название проекта для создания папки (убираем спецсимволы)
    const folderName = project.replace(/[^a-z0-9]/gi, '_').toLowerCase();
    const projectPath = path.join(__dirname, 'image', folderName);
    
    // Создаем папку проекта, если её нет
    if (!fs.existsSync(projectPath)){
        fs.mkdirSync(projectPath, { recursive: true });
    }

    const filePath = path.join(projectPath, name);
    
    const base64Data = data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Data, 'base64');

    fs.writeFile(filePath, buffer, (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Error saving image');
        }
        console.log(`[${new Date().toLocaleTimeString()}] Картинка загружена в: image/${folderName}/${name}`);
        res.send(`image/${folderName}/${name}`); // Возвращаем путь для админки
    });
});

app.listen(port, () => {
    console.log(`
    ====================================================
    СЕРВЕР СОХРАНЕНИЯ ЗАПУЩЕН: http://localhost:3000
    ====================================================
    `);
});
