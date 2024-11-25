Require('dotenv').config();
const express = require('express');
const { Telegraf, Markup } = require('telegraf');
const axios = require('axios');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const app = express();
const bot = new Telegraf(process.env.BOT_TOKEN);

// Check if BOT_TOKEN and BASE_URL are set
if (!process.env.BOT_TOKEN || !process.env.BASE_URL) {
    console.error('Error: BOT_TOKEN or BASE_URL is not set!');
    process.exit(1);
}

// Ensure the downloads directory exists
const downloadsDir = './downloads';
if (!fs.existsSync(downloadsDir)) {
    fs.mkdirSync(downloadsDir);
}

// Function to generate a file download link based on the hash
function generateFileDownloadLink(hash) {
    return `${process.env.BASE_URL}/download/${hash}`;
}

// Function to generate hash
function generateHash(filePath, algorithm = 'sha256') {
    return new Promise((resolve, reject) => {
        const hash = crypto.createHash(algorithm);
        const stream = fs.createReadStream(filePath);

        stream.on('data', (chunk) => hash.update(chunk));
        stream.on('end', () => resolve(hash.digest('hex')));
        stream.on('error', (err) => reject(err));
    });
}

// Function to generate and send hash
async function generateAndSendHash(ctx, fileId, fileName) {
    console.log(`Downloading file: ${fileName}`);
    try {
        const fileLink = await ctx.telegram.getFileLink(fileId);
        const filePath = path.join(downloadsDir, fileName);
        const writer = fs.createWriteStream(filePath);

        const response = await axios({
            url: fileLink.href,
            method: 'GET',
            responseType: 'stream',
            // **Important:** Set a reasonable maximum content length to avoid resource exhaustion
            maxContentLength: 1024 * 1024 * 1024 * 1 (1GB limit) // Adjust as needed
        });

        response.data.pipe(writer);

        writer.on('finish', async () => {
            const stats = fs.statSync(filePath);
            console.log(`Downloaded file size: ${stats.size} bytes`);

            if (stats.size > 2 * 1024 * 1024 * 1024) {
                console.error('Error: File size exceeds recommended limit (1GB)!');
                await ctx.reply('Error: File size exceeds recommended limit (1GB)!');
                return;
            }

            try {
                const hash = await generateHash(filePath);
                console.log(`File hash: ${hash}`);

                const newFilePath = path.join(downloadsDir, `${hash}.mp4`);
                fs.renameSync(filePath, newFilePath);

                const photoUrl = 'https://graph.org/file/4e8a1172e8ba4b7a0bdfa.jpg'; // Your photo URL
                await sendPhotoWithLink(ctx, photoUrl, hash, fileName, stats.size);
            } catch (error) {
                console.error('Hash generation error:', error);
                await ctx.reply('Error generating hash!');
            }
        });

        writer.on('error', (error) => {
            console.error('Error writing file:', error);
            ctx.reply('Error downloading file!');
        });

    } catch (error) {
        console.error('Error in generateAndSendHash:', error);
        await ctx.reply(' File size limit exceeded!');
    }
}

// Function to post the file and photo with buttons to a specified channel
async function postToChannel(hash, fileName, fileSize) {
    const filePath = path.join(downloadsDir, `${hash}.mp4`);
    const photoUrl = 'https://graph.
