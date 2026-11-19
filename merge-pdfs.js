
const fs = require('fs');
const path = require('path');
const { PDFDocument } = require('pdf-lib');

const INPUT_DIR = path.join(__dirname, 'student-pdfs');
const OUTPUT_FILE = path.join(__dirname, 'all-students-merged.pdf');

async function mergePDFs() {
    try {
        console.log('Looking for student PDFs...');

        const files = fs.readdirSync(INPUT_DIR)
            .filter(file => file.toLowerCase().endsWith('.pdf'))
            .sort((a, b) => {
                const numA = BigInt(path.parse(a).name);
                const numB = BigInt(path.parse(b).name);

                return numA < numB ? -1 : numA > numB ? 1 : 0;
            });

        if (files.length === 0) {
            console.log('No PDF files found!');
            return;
        }

        console.log(`Found ${files.length} PDFs.`);

        const mergedPDF = await PDFDocument.create();

        for (const file of files) {
            console.log(`Merging: ${file}`);

            const filePath = path.join(INPUT_DIR, file);
            const pdfBytes = fs.readFileSync(filePath);

            const studentPDF = await PDFDocument.load(pdfBytes);

            const copiedPages = await mergedPDF.copyPages(
                studentPDF,
                studentPDF.getPageIndices()
            );

            copiedPages.forEach(page => {
                mergedPDF.addPage(page);
            });
        }

        const mergedBytes = await mergedPDF.save();

        fs.writeFileSync(OUTPUT_FILE, mergedBytes);

        console.log('\n-----------------------------');
        console.log('PDF MERGE COMPLETED!');
        console.log(`Students merged: ${files.length}`);
        console.log(`Output: ${OUTPUT_FILE}`);
        console.log('-----------------------------');

    } catch (error) {
        console.error('PDF merge failed:', error);
    }
}

mergePDFs();
