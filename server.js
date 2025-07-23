const express = require('express');
const multer = require('multer');
const fs = require('fs');
const crypto = require('crypto');
const { exec } = require('child_process');
const app = express();

const upload = multer({ dest: 'public/videos/' });
const DATA_FILE = 'videoData.json';

let videoData = fs.existsSync(DATA_FILE)
  ? JSON.parse(fs.readFileSync(DATA_FILE))
  : [];

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

function generateCode() {
  return crypto.randomBytes(6).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 10);
}

function getVideoDuration(filePath) {
  return new Promise((resolve) => {
    exec(`ffprobe -v error -show_entries format=duration -of csv=p=0 "${filePath}"`, (err, stdout) => {
      if (err) return resolve(0);
      resolve(parseFloat(stdout.trim()));
    });
  });
}

app.post('/upload', upload.single('video'), async (req, res) => {
  const code = generateCode();
  const filepath = `public/videos/${req.file.filename}`;
  const duration = await getVideoDuration(filepath);

  const newVid = {
    code,
    filename: req.file.filename,
    title: req.body.title || 'Untitled Video',
    duration,
    uploadedAt: new Date().toISOString()
  };

  videoData.push(newVid);
  fs.writeFileSync(DATA_FILE, JSON.stringify(videoData, null, 2));
  res.redirect('/watch/' + code);
});

app.get('/videos', (req, res) => res.json(videoData));

app.get('/watch/:code', (req, res) => {
  const vid = videoData.find(v => v.code === req.params.code);
  if (!vid) return res.status(404).send('Video not found');

  const html = `
    <!DOCTYPE html>
    <html>
    <head><title>${vid.title}</title></head>
    <body>
      <h1>${vid.title}</h1>
      <video controls width="640">
        <source src="/videos/${vid.filename}" type="video/mp4">
      </video>
      <p>Duration: ${Math.floor(vid.duration)} seconds</p>
      <p><a href="/">Back to Home</a></p>
    </body>
    </html>
  `;
  res.send(html);
});

app.get('/shorts', (req, res) => {
  const shorts = videoData.filter(v => v.duration < 30);
  const items = shorts.map(v => `
    <div style="margin-bottom:30px;">
      <h3>${v.title}</h3>
      <a href="/shorts/${v.code}">
        <video src="/videos/${v.filename}" width="300" controls></video>
      </a>
    </div>
  `).join('') || '<p>No short videos yet. <a href="/upload.html">Upload one?</a></p>';

  res.send(`
    <html>
    <head><title>Short Videos</title></head>
    <body>
      <h1>Short Videos</h1>
      ${items}
      <p><a href="/">Back to Home</a></p>
    </body>
    </html>
  `);
});

app.get('/shorts/:code', (req, res) => {
  const vid = videoData.find(v => v.code === req.params.code && v.duration < 30);
  if (!vid) return res.status(404).send('Short video not found');

  res.send(`
    <html>
    <head><title>${vid.title}</title></head>
    <body>
      <h1>${vid.title}</h1>
      <video controls width="640">
        <source src="/videos/${vid.filename}" type="video/mp4">
      </video>
      <p>This is a short video (${Math.floor(vid.duration)}s)</p>
      <p><a href="/shorts">Back to Short Videos</a></p>
    </body>
    </html>
  `);
});

app.listen(3000, () => console.log('🚀 Running at http://localhost:3000'));
