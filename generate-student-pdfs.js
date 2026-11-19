require('dotenv').config();
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const START_URL = process.env.BSE_START_URL;

if (!START_URL) {
    throw new Error('BSE_START_URL is missing in .env file');
}
const OUTPUT_DIR = path.join(__dirname, 'student-pdfs');
const PROFILE_DIR = path.join(__dirname, 'browser-profile');

// TEST MODE: generate only one PDF first.
const MAX_STUDENTS = 49;

function waitForEnter(message) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise(resolve => {
        rl.question(message, () => {
            rl.close();
            resolve();
        });
    });
}

async function main() {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });

    const context = await chromium.launchPersistentContext(
        PROFILE_DIR,
        {
            headless: false,
            viewport: { width: 1440, height: 1000 }
        }
    );

    let page = context.pages()[0] || await context.newPage();

    // Apply print interception to all pages, including popups.
    await context.addInitScript(() => {
        window.__printRequested = false;

        window.print = () => {
            window.__printRequested = true;
        };
    });

    try {
        // STEP 1: Open the Telangana BSE website.
        console.log('\nOpening Telangana BSE website...');

        await page.goto(START_URL, {
            waitUntil: 'domcontentloaded',
            timeout: 60000
        });

        // STEP 2: Find and click the SSC School Login link.
        console.log('\nLooking for SSC School Login link...');

        const loginLink = page.getByRole('link', {
            name: /SSC Examination March-2027 Fee Payment School Login/i
        });

        await loginLink.waitFor({
            state: 'visible',
            timeout: 30000
        });

        console.log('SSC School Login link found.');

        // Listen for a new tab in case the link opens one.
        const newPagePromise = context.waitForEvent('page', {
            timeout: 5000
        }).catch(() => null);

        await loginLink.click();

        const newPage = await newPagePromise;

        if (newPage) {
            page = newPage;
            console.log('Login portal opened in a new tab.');
        } else {
            console.log('Login portal opened in the current tab.');
        }

        await page.waitForLoadState('domcontentloaded', {
            timeout: 30000
        }).catch(() => { });

        await page.waitForTimeout(2000);

        console.log('Portal URL:', page.url());

        await page.bringToFront();

        // STEP 3: Login manually.
        console.log('\n--------------------------------');
        console.log('MANUAL LOGIN REQUIRED');
        console.log('Please log in using your school credentials.');
        console.log('Wait until the dashboard is visible.');
        console.log('--------------------------------\n');

        await waitForEnter(
            'After reaching the dashboard, press ENTER here... '
        );

        console.log('Current URL:', page.url());

        // Do not navigate to /login again.
        // Continue using the authenticated session.

        // STEP 4: Open Confirm Student Details.
        console.log('\nOpening Confirm Student Details...');

        const rosterHeading = page.getByText(
            'Student Details Confirmation Roster',
            { exact: false }
        );

        const alreadyOnRoster = await rosterHeading.isVisible()
            .catch(() => false);

        if (!alreadyOnRoster) {
            const menuItem = page.getByText(
                'Confirm Student Details',
                { exact: true }
            ).first();

            await menuItem.waitFor({
                state: 'visible',
                timeout: 30000
            });

            await menuItem.click();

            await rosterHeading.waitFor({
                state: 'visible',
                timeout: 30000
            });
        }

        console.log('Student roster successfully loaded.');

        await page.screenshot({
            path: path.join(__dirname, 'roster-loaded.png'),
            fullPage: true
        });

        // STEP 5: Find student rows.
        let processed = 0;

        const rows = page.locator('tr').filter({
            has: page.getByRole('button', {
                name: /^print$/i
            })
        });

        const rowCount = await rows.count();

        console.log(`Found ${rowCount} student rows.`);

        for (let i = 0; i < rowCount; i++) {
            if (processed >= MAX_STUDENTS) break;

            const row = rows.nth(i);

            const printButton = row.getByRole('button', {
                name: /^print$/i
            });

            if (await printButton.count() === 0) continue;

            const rowText = await row.innerText();

            // Only process confirmed students.
            if (!/confirmed/i.test(rowText)) continue;

            console.log(`\nOpening student row ${i + 1}...`);

            await printButton.first().click();

            // STEP 6: Wait for Verification Sheet.
            const verificationHeading = page.getByText(
                'Verification Sheet',
                { exact: false }
            );

            await verificationHeading.waitFor({
                state: 'visible',
                timeout: 20000
            });

            await page.waitForTimeout(1500);

            await page.screenshot({
                path: path.join(__dirname, 'verification-modal.png')
            });

            // STEP 7: Extract PEN.
            const bodyText = await page.locator('body').innerText();

            const penMatches = [
                ...bodyText.matchAll(
                    /\bPEN\s*[:#]?\s*(\d{8,})/gi
                )
            ];

            const match = penMatches[penMatches.length - 1];

            if (!match) {
                throw new Error(
                    'Could not identify PEN in verification sheet. ' +
                    'Check verification-modal.png'
                );
            }

            const pen = match[1];

            console.log(`Detected PEN: ${pen}`);

            const outputPath = path.join(
                OUTPUT_DIR,
                `${pen}.pdf`
            );

            if (fs.existsSync(outputPath)) {
                console.log(`${pen}.pdf already exists. Skipping.`);
                await closeModal(page);
                continue;
            }

            // STEP 8: Click Print inside the verification sheet.
            await page.evaluate(() => {
                window.__printRequested = false;
            });

            const modalPrintButtons = page.getByRole('button', {
                name: /^print$/i
            });

            const buttonCount = await modalPrintButtons.count();

            if (buttonCount < 1) {
                throw new Error(
                    'Verification sheet Print button not found.'
                );
            }

            await modalPrintButtons.last().click();

            await page.waitForFunction(
                () => window.__printRequested === true,
                { timeout: 15000 }
            );

            console.log('Print request intercepted.');

            // STEP 9: Generate PDF.
            const cdp = await context.newCDPSession(page);

            try {
                const result = await cdp.send('Page.printToPDF', {
                    printBackground: true,
                    preferCSSPageSize: true
                });

                fs.writeFileSync(
                    outputPath,
                    Buffer.from(result.data, 'base64')
                );

            } finally {
                await cdp.detach();
            }

            console.log(`PDF saved: ${pen}.pdf`);

            processed++;

            // STEP 10: Close verification sheet.
            await closeModal(page);

            await page.waitForTimeout(1000);
        }

        console.log('\n--------------------------------');
        console.log(`PDFs generated: ${processed}`);
        console.log(`Output folder: ${OUTPUT_DIR}`);
        console.log('--------------------------------');

    } catch (error) {
        console.error('\nAUTOMATION FAILED:');
        console.error(error);

        await page.screenshot({
            path: path.join(__dirname, 'automation-error.png'),
            fullPage: true
        }).catch(() => { });

        console.log('\nError screenshot saved as automation-error.png');
    }

    await waitForEnter(
        '\nPress ENTER to close the browser... '
    );

    await context.close();
}


async function closeModal(page) {
    console.log('Closing Verification Sheet...');

    // First try the accessible name of the X button.
    const closeButton = page.getByRole('button', {
        name: /close|dismiss/i
    });

    if (await closeButton.count() > 0) {
        await closeButton.last().click();
    } else {
        // Inspect buttons if the X button has no accessible name.
        const buttons = await page.locator('button').evaluateAll(
            elements => elements.map((button, index) => ({
                index,
                text: button.innerText,
                ariaLabel: button.getAttribute('aria-label'),
                title: button.getAttribute('title'),
                html: button.outerHTML.slice(0, 300)
            }))
        );

        console.log('Available buttons:', buttons);

        throw new Error(
            'Could not identify the Verification Sheet close button.'
        );
    }

    await page.getByText('Verification Sheet', {
        exact: false
    }).waitFor({
        state: 'hidden',
        timeout: 10000
    });

    console.log('Verification Sheet closed successfully.');
}

main();
