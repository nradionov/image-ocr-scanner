import {createWorker} from 'tesseract.js';
import fs from 'fs';

import {promisify} from 'util';

const readdir = promisify(fs.readdir);
const writeFile = promisify(fs.writeFile);

const worker = await createWorker({
    logger: m => console.log(m)
});

const CSV_CELL_SEPARATOR = ';';
const supportedExtensions = ['png', 'jpg', 'jpeg'];
const outputFormats = {
    'tsv': 'tsv',
    'txt': 'txt',
    'hocr': 'hocr',
    'pdf': 'pdf'
};

const convertArrayToCSV = (array) => {
    let csv = '';
    array.forEach(row => {
        csv += row
            //encapsulate newlines that break the CSV
            .map(entry => entry.replace(/\n/g, '\\n'))
            .join(CSV_CELL_SEPARATOR) + '\n';
    });
    return csv;
};

const createCSVFile = async (data, filename) => {
    const csvData = convertArrayToCSV(data);
    try {
        await writeFile(filename, csvData);
        console.log('Successfully created CSV file ' + filename);
    } catch (err) {
        console.error('Error creating CSV file ' + filename + '. Error:', err);
    }
};

(async () => {
    await worker.loadLanguage('eng');
    await worker.initialize('eng');

    try {
        const files = await readdir('./input');
        if (!files || !files.length) {
            console.log('No files found in the input folder');
            return;
        }
        console.log("Filtering files in the input folder by extensions:  " + supportedExtensions.join(', '));
        const filteredFiles = files.filter(file => {
            const extension = file.split('.').pop();
            return supportedExtensions.includes(extension);
        });

        if (!filteredFiles || !filteredFiles.length) {
            console.log('No files found in the input folder with supported extensions');
            return;
        }

        console.log("Found " + filteredFiles.length + " files in the input folder with supported extensions");

        const rootOutputFolder = './output/' + new Date().toISOString().split('.').shift() ;
        const filesOutputFolder = rootOutputFolder + '/files';
        const promises = [];
        const csvReport = [
            ['Input File Name', 'Output File Name', 'Parsed Content']
        ];
        for (const file of filteredFiles) {
            const csvRow = [file];
            console.log("Processing file: " + file + " in format of " + outputFormats.tsv);
            try {
                if (!fs.existsSync(filesOutputFolder)) {
                    fs.mkdirSync(filesOutputFolder, {recursive: true});
                }
                const outputFileName = filesOutputFolder + "/" + file.split('.').shift() + '.txt'
                csvRow.push(outputFileName);
                console.log("Writing output to file: " + outputFileName);

                const {data: {text}} = await worker.recognize('./input/' + file, {}, outputFormats.tsv);
                csvRow.push(text);
                await writeFile(outputFileName, text);
            } catch (err) {
                console.log('Error writing output to file: ' + file + '.txt. ' + err);
                csvRow.push("ERROR", "ERROR");
            }
            csvReport.push(csvRow);
        }
        await Promise.all(promises);
        console.log("Finished processing " + filteredFiles.length + " files in the input folder");


        await createCSVFile(csvReport, rootOutputFolder + "/report.csv");

    } catch (err) {
        console.log('No input folder found. Please create an input folder and put your files in it. ' + err);
    }
    await worker.terminate();
})();