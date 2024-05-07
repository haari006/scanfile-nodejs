const express = require('express');
const multer = require('multer');
const axios = require('axios');
const FormData = require('form-data');
const cors = require('cors');
const fs = require('fs');
const app = express();
const port = 3003;
require('dotenv').config();

// Setup multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Middleware
app.use(cors());
app.use(express.json());
const apiKey = process.env.API_KEY;

app.post('/submit-file', upload.single('file'), async (req, res) => {
    if (!req.file) {
        return res.status(400).send('No file uploaded.');
    }

    const filePath = req.file.path;
    const scanType = req.body.scanType || 'all';

    const formData = new FormData();
    formData.append('file', fs.createReadStream(filePath));
    formData.append('scan_type', scanType);

    try {
        const response = await axios.post(`https://www.hybrid-analysis.com/api/v2/quick-scan/file`, formData, {
            headers: {
                ...formData.getHeaders(),
                'api-key': apiKey,
            },
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error submitting file for scanning:', error);
        res.status(500).send(error.message);
    } finally {
        fs.unlinkSync(filePath); // Clean up the uploaded file
    }
});

app.get('/poll-status/:id', async (req, res) => {
    const { id } = req.params;

    try {
        const data = await pollUntilStatusChanges(id);
        res.json(data);
    } catch (error) {
        console.error('Error polling status:', error);
        res.status(500).send(error.message);
    }
});

const pollUntilStatusChanges = async (
  id,
  interval = 3000,
  timeout = 300000
) => {
  const startTime = Date.now();

  return new Promise((resolve, reject) => {
    const poll = async () => {
      if (Date.now() - startTime >= timeout) {
        reject(new Error("Polling timed out"));
        return;
      }

      try {
        const response = await axios.get(
          `https://www.hybrid-analysis.com/api/v2/overview/${id}`,
          {
            headers: {
              "api-key": apiKey,
            },
          }
        );

        const data = response.data;

        const scanners = data.scanners || [];
        const remainingScannersInQueue = scanners.filter(
          (scanner) => scanner.status === "in-queue"
        );

        if (remainingScannersInQueue.length === 0) {
          resolve(data);
        } else {
          console.log(
            `Remaining scanners in queue: ${remainingScannersInQueue.length}`
          );
          setTimeout(poll, interval);
        }
      } catch (error) {
        reject(error);
      }
    };

    poll();
  });
};  

app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
