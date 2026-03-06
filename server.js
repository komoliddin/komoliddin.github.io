const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const app = express();
const port = 3000;

app.use(cors());
app.use(express.json({ limit: '100mb' })); // Увеличил лимит для тяжелых фото
app.use(express.static(__dirname));

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
        
        if (!fs.existsSync(projectPath)){
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
