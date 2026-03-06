const express = require('express');
const fs = require('fs');
const path = require('path');
const app = express();
const port = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.static(__dirname));

// Маршрут для сохранения JSON файлов
app.post('/save-data', (req, res) => {
    const { filename, data } = req.body;
    const filePath = path.join(__dirname, filename);

    fs.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8', (err) => {
        if (err) {
            console.error(err);
            return res.status(500).send('Ошибка при записи файла');
        }
        console.log(`Файл ${filename} успешно обновлен!`);
        res.send('Успешно сохранено');
    });
});

app.listen(port, () => {
    console.log(`
    ====================================================
    СЕРВЕР ЗАПУЩЕН: http://localhost:${port}
    Теперь админка будет сохранять файлы НАПРЯМУЮ!
    ====================================================
    `);
});
