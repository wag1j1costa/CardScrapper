const puppeteer = require('puppeteer');
const { printTable, Table } = require('console-table-printer');
const moment = require('moment');
const fs = require('fs').promises; // Using promises for async/await syntax
const axios = require('axios');

console.log('Iniciando o processo de extração de dados...');

(async () => {
    const browser = await puppeteer.launch({ headless: true, executablePath:"/usr/bin/chromium" }); //on linux: , executablePath:"/usr/bin/chromium"
    const page = await browser.newPage();

    await page.goto('https://www.vilacelta.com.br/?view=ecom/logar');

    // Aceitar todos os cookies
    await page.waitForSelector('#lgpd-cookie button'); // Aguarde o botão de cookies ficar visível
    await page.click('#lgpd-cookie button');

    // Preencha os campos de login e senha
    await page.waitForSelector('input[name=lnick]');
    await page.$eval('input[name=lnick]', el => el.value = 'felipefarion@gmail.com');
    await page.waitForSelector('input[name=lsenha]');
    await page.$eval('input[name=lsenha]', el => el.value = '12Senha@34');

    // Localize o botão de login pelo valor "Efetuar login" e clique nele
    await page.$eval('form[method="POST"]', form => form.submit());

    // Espere um tempo para garantir que o login seja concluído (você pode ajustar esse tempo conforme necessário)
    await page.waitForTimeout(3000); // Espera por 3 segundos (tempo em milissegundos)

    // await page.goto('https://www.vilacelta.com.br/?view=ecom/admin/cartas/all&tcg=1');

    // Começando na página 1
    let currentPage = 1610;
    let hasMorePages = true;
    let pageCount = 0; // Counter for the current 500-page block
    let fileSuffix = 161; // Suffix for the CSV file name

    const fTable = new Table();

    // Create an empty array to store all card data
    const allCardsData = [];
    const notFoundCardsData = []; // Array to store cards not found in Scryfall
    const normalizeString = (str) => {
        return str.replace(/\W/g, '').toLowerCase();
    };
    
    while (hasMorePages) {
        // Definindo a URL da página
        const url = `https://www.vilacelta.com.br/?view=ecom/admin/cartas/all&tcg=1&page=${currentPage}`;
        await page.goto(url);

        // Esperando a tabela carregar
        await page.waitForSelector('table.table-allTCG-order-0');
        cardsData = [];

        const rows = await page.$$('table.table-allTCG-order-0 tbody tr');

        for (const row of rows) {
            const cardNumber = await row.$$eval('td:nth-child(8) font.card-number-small', elements => {
                return elements.map(el => {
                    const codeText = el.innerHTML.trim(); // Divide o HTML em linhas
                    return codeText.replace(/\((.+?)<b>(\S+)<\/b>\)/g, "$1_$2"); // Formata cada linha e junta novamente
                });
            });
            const cardName = await row.$$eval('td:nth-child(8) a:nth-child(2)', elements => elements.map(el => el.textContent.trim() ?? 'N/A'));
            const cardLink = await row.$$eval('td:nth-child(8) a', elements => elements.map(el => el.href ?? 'N/A'));
            const cardEdition = await row.$$eval('td:nth-child(8) a img', elements => elements.map(el => el.title ?? 'N/A'));
            const cardImage = await row.$$eval('td:nth-child(1) img', elements => elements.map(el => el.src ?? 'N/A'));
            const inputStock = await row.$$eval('td:nth-child(1) input[type="text"]', elements => elements.map(el => el.value ?? 'N/A'));
            const inputPrice = await row.$$eval('td:nth-child(3) input[type="text"]', elements => elements.map(el => el.value ?? 'N/A'));
            const cardIdiom = await row.$$eval('td:nth-child(5) select option[selected]', elements => elements.map(el => el.textContent.trim() ?? 'N/A'));
            const cardQuality = await row.$$eval('td:nth-child(6) select option[selected]', elements => elements.map(el => el.textContent.trim() ?? 'N/A'));
            const cardExtras = await row.$$eval('td:nth-child(7) select option[selected]', elements => elements.map(el => el.textContent.trim() ?? 'N/A'));

            if (cardNumber.length === 0) {
                continue;
            }

            //conferir se o card existe no scryfall
            let cardNameParts = cardName[0].split(/\s\/\s(?!\/)/);
            let cardNameScryfall = cardNameParts[1] ?? cardNameParts[0];
            let setParts = cardNumber[0].split('_');
            let cardNumberScryfall = setParts[1];
            let cardSetScryfall = setParts[0].toLowerCase() ?? 'n/a' ;
            let urlScryfall = `https://api.scryfall.com/cards/${cardSetScryfall}/${cardNumberScryfall}`;

            try {
                const response = await axios.get(urlScryfall);
                const normalizedCardName = normalizeString(cardNameScryfall);
                const normalizedScryfallName = normalizeString(response.data.name);

                if (response.status === 200 && normalizedCardName === normalizedScryfallName) {
                    continue; // Skip if card exists in Scryfall
                }
            } catch (error) {
                console.log(`Erro ao buscar o card ${cardNameScryfall} no Scryfall: ${error.message}`);
            }

            // If card not found in Scryfall, add to notFoundCardsData
            notFoundCardsData.push({
                'Número': cardNumber,
                'Nome': cardName,
                'Link': cardLink,
                'Edição': cardEdition,
                'Imagem': cardImage,
                'Estoque': inputStock,
                'Preço': inputPrice,
                'Idioma': cardIdiom,
                'Qualidade': cardQuality,
                'Extras': cardExtras
            });

            allCardsData.push({
                'Número': cardNumber,
                'Nome': cardName,
                'Link': cardLink,
                'Edição': cardEdition,
                'Imagem': cardImage,
                'Estoque': inputStock,
                'Preço': inputPrice,
                'Idioma': cardIdiom,
                'Qualidade': cardQuality,
                'Extras': cardExtras
            });
        }

        // Increment page counters and check for next page
        pageCount++;
        if (pageCount === 10) {
            // Save CSV file for the current block
            const csvData = allCardsData.map((card) =>
                Object.values(card).join(';') // Convert object to comma-separated string
            ).join('\n'); // Join all rows with newlines

            await fs.writeFile(`scraped_cards_${fileSuffix}-${pageCount}.csv`, csvData, 'utf8');
            console.log(`Dados salvos com sucesso em scraped_cards_${fileSuffix}-${pageCount}.csv`);

            // Reset counters and file suffix for the next block
            pageCount = 0;
            fileSuffix++;
            allCardsData.length = 0; // Clear the array
        }

        // Processando os números das cartas e imprimindo-os
        console.log(`\n\nPágina atual: ${currentPage}\n\n`);

        // Verificando se há mais páginas
        hasMorePages = await page.evaluate(() => {
            // Procurando pelo elemento que indica a próxima página
            const nextPageButton = document.querySelector('a.page_mais');
            return nextPageButton !== null;
        });

        // Incrementando o número da página
        if (hasMorePages) {
            currentPage++;
        }
    }

    await browser.close();

    // Save remaining data (if less than 500 pages)
    if (pageCount > 0) {
        const csvData = allCardsData.map((card) =>
            Object.values(card).join(';') // Convert object to comma-separated string
        ).join('\n'); // Join all rows with newlines

        await fs.writeFile(`scraped_cards_${fileSuffix}-${pageCount}.csv`, csvData, 'utf8');
        console.log(`Dados salvos com sucesso em scraped_cards_${fileSuffix}-${pageCount}.csv`);
    }

    // Save not found data
    if (notFoundCardsData.length > 0) {
        const notFoundCsvData = notFoundCardsData.map((card) =>
            Object.values(card).join(';') // Convert object to comma-separated string
        ).join('\n'); // Join all rows with newlines

        await fs.writeFile(`not_found_cards.csv`, notFoundCsvData, 'utf8');
        console.log(`Dados de cards não encontrados salvos com sucesso em not_found_cards.csv`);
    }
})();
