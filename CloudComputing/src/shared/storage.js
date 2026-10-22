const fs = require('fs');
const path = require('path');

const profileFolder = 'photo-profile-user';
const postFolder = 'image-post';
const scanHistoryFolder = 'scan-history';

const saveFileToDisk = (req, file, folder) => new Promise((resolve, reject) => {
  try {
    const dir = path.join(__dirname, '..', '..', 'uploads', folder);
    fs.mkdirSync(dir, { recursive: true });
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const fileName = `${Date.now()}-${safeName}`;
    fs.writeFileSync(path.join(dir, fileName), file.buffer);
    resolve(`${req.protocol}://${req.get('host')}/uploads/${folder}/${fileName}`);
  } catch (err) { reject(err); }
});

module.exports = { saveFileToDisk, profileFolder, postFolder, scanHistoryFolder };
