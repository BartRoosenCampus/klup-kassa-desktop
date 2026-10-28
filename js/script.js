let huidigeBon = [];
let beschikbareProducten = [];
let actieveCategorie = 'Alle';

let pendingAfrekening = null;

// Helperfunctie om categorieën als array op te halen (ondersteunt zowel array als oude string-notatie)
function getProductCategories(prod) {
    if (Array.isArray(prod.categorie)) {
        return prod.categorie;
    } else if (prod.categorie) {
        return [prod.categorie];
    }
    return [];
}

// 1. Producten inladen uit producten.json
async function laadProducten() {
    try {
        let response = await fetch('json/producten.json');
        if (!response.ok) throw new Error('Kon producten.json niet laden');
        beschibareProducten = await response.json();
        beschikbareProducten = beschibareProducten; // fix spelling variabele

        bouwCategorieFilters();
        bouwProductKnoppen();
    } catch (error) {
        alert("Let op: Kan 'producten.json' niet laden via directe bestandstoegang. Gebruik een lokale server (zoals Live Server in VS Code).");
        console.error(error);
    }
}

// 2. Categorie filterknoppen genereren (Verzamel alle unieke categorieën uit de arrays)
function bouwCategorieFilters() {
    let filterContainer = document.getElementById('categorieFilter');
    if (!filterContainer) return;
    filterContainer.innerHTML = '';

    let alleCatSet = new Set();
    beschikbareProducten.forEach(p => {
        getProductCategories(p).forEach(c => alleCatSet.add(c));
    });

    let categorieen = ['Alle', ...alleCatSet];

    categorieen.forEach(cat => {
        let btn = document.createElement('button');
        btn.className = `cat-btn ${cat === actieveCategorie ? 'active' : ''}`;
        btn.innerText = cat;
        btn.onclick = () => {
            actieveCategorie = cat;
            bouwCategorieFilters();
            bouwProductKnoppen();
        };
        filterContainer.appendChild(btn);
    });
}

// 3. Productknoppen genereren (Filter op producten waarin de actieve categorie voorkomt)
function bouwProductKnoppen() {
    let grid = document.getElementById('productGrid');
    if (!grid) return;
    grid.innerHTML = '';

    let gefilterd = actieveCategorie === 'Alle'
        ? beschikbareProducten
        : beschikbareProducten.filter(p => getProductCategories(p).includes(actieveCategorie));

    gefilterd.forEach(prod => {
        let btn = document.createElement('button');
        btn.className = 'product-btn';
        btn.style.backgroundColor = prod.kleur || '#28a745';
        btn.innerHTML = `${prod.naam} <span class="product-prijs">&euro; ${prod.prijs.toFixed(2)}</span>`;
        btn.onclick = () => voegToe(prod.naam, prod.prijs);
        grid.appendChild(btn);
    });
}

// Product toevoegen aan de actieve bon
function voegToe(naam, prijs) {
    let bestaandItem = huidigeBon.find(item => item.naam === naam);
    if (bestaandItem) {
        bestaandItem.aantal++;
    } else {
        huidigeBon.push({ naam: naam, prijs: prijs, aantal: 1 });
    }
    updateBonScherm();
}

// Item verwijderen van bon
function verwijderItem(naam) {
    huidigeBon = huidigeBon.filter(item => item.naam !== naam);
    updateBonScherm();
}

// Bon scherm updaten
function updateBonScherm() {
    let bonBody = document.getElementById('bonBody');
    let totaalPrijsEl = document.getElementById('totaalPrijs');
    if (!bonBody || !totaalPrijsEl) return;
    bonBody.innerHTML = '';

    let totaal = 0;

    huidigeBon.forEach(item => {
        let subtotaal = item.prijs * item.aantal;
        totaal += subtotaal;

        let row = `<tr>
            <td>${item.naam}</td>
            <td>${item.aantal}</td>
            <td>&euro; ${subtotaal.toFixed(2)}</td>
            <td><button class="btn btn-danger btn-small" onclick="verwijderItem('${item.naam}')">X</button></td>
        </tr>`;
        bonBody.innerHTML += row;
    });

    totaalPrijsEl.innerText = totaal.toFixed(2);
}

function wisHuidigeBon() {
    huidigeBon = [];
    updateBonScherm();
}

// --- BETAALMETHODE MODAL BEHEER ---

function vraagBetaalmethodeDirect() {
    if (huidigeBon.length === 0) {
        alert("De bon is leeg!");
        return;
    }

    let totaalBedrag = huidigeBon.reduce((sum, i) => sum + (i.prijs * i.aantal), 0);
    pendingAfrekening = {
        type: 'direct',
        items: [...huidigeBon],
        bronInfo: 'Directe Verkoop',
        totaal: totaalBedrag
    };

    document.getElementById('betaalInfoTekst').innerText = `Afrekenen van directe verkoop (&euro; ${totaalBedrag.toFixed(2)})`;
    document.getElementById('betaalModal').style.display = 'flex';
}

function vraagBetaalmethodeTafel(naam) {
    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    let bestellingenVanNaam = openstaande.filter(r => r.naam === naam);

    let alleGecombineerdeItems = [];
    let totaalBedrag = 0;

    bestellingenVanNaam.forEach(rek => {
        totaalBedrag += parseFloat(rek.totaal);
        rek.items.forEach(item => {
            let bestaand = alleGecombineerdeItems.find(i => i.naam === item.naam);
            if (bestaand) {
                bestaand.aantal += item.aantal;
            } else {
                alleGecombineerdeItems.push({ ...item });
            }
        });
    });

    pendingAfrekening = {
        type: 'tafel',
        naam: naam,
        items: alleGecombineerdeItems,
        bronInfo: `Tafel/Naam: ${naam}`,
        totaal: totaalBedrag
    };

    document.getElementById('betaalInfoTekst').innerText = `Hele rekening van "${naam}" afrekenen (&euro; ${totaalBedrag.toFixed(2)})`;
    document.getElementById('betaalModal').style.display = 'flex';
}

function sluitBetaalModal() {
    document.getElementById('betaalModal').style.display = 'none';
    pendingAfrekening = null;
}

function kiesBetaalmethode(methode) {
    if (!pendingAfrekening) return;

    slaBestellingOpInGeschiedenis(pendingAfrekening.items, pendingAfrekening.bronInfo, methode);

    if (pendingAfrekening.type === 'direct') {
        wisHuidigeBon();
    } else if (pendingAfrekening.type === 'tafel') {
        let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
        let overgebleven = openstaande.filter(r => r.naam !== pendingAfrekening.naam);
        localStorage.setItem('open_rekeningen', JSON.stringify(overgebleven));
        laadOpenstaandeRekeningen();
    }

    sluitBetaalModal();
}

// --- MODAL / POP-UP BEHEER VOOR NAMEN ---

function openNaamModal() {
    if (huidigeBon.length === 0) {
        alert("De bon is leeg!");
        return;
    }

    let containerEl = document.getElementById('bestaandeNamenKnoppen');
    containerEl.innerHTML = '';

    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    let uniekeNamen = [...new Set(openstaande.map(r => r.naam))];

    if (uniekeNamen.length === 0) {
        containerEl.innerHTML = '<span style="font-size: 13px; color: var(--text-muted);">Geen openstaande rekeningen</span>';
    } else {
        uniekeNamen.forEach(naam => {
            let btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn';
            btn.innerText = naam;
            btn.onclick = () => {
                sluitNaamModal();
                bewaarOpNaam(naam);
            };
            containerEl.appendChild(btn);
        });
    }

    document.getElementById('nieuweNaamInput').value = '';
    document.getElementById('naamModal').style.display = 'flex';
}

function sluitNaamModal() {
    document.getElementById('naamModal').style.display = 'none';
}

function bevestigNieuweNaam() {
    let getypteNaam = document.getElementById('nieuweNaamInput').value.trim();

    if (!getypteNaam || getypteNaam === "") {
        alert("Typ een nieuwe naam of tafel in!");
        return;
    }

    sluitNaamModal();
    bewaarOpNaam(getypteNaam);
}

function bewaarOpNaam(naam) {
    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    let totaalBedrag = huidigeBon.reduce((sum, i) => sum + (i.prijs * i.aantal), 0);

    let nu = new Date();
    let datumStr = nu.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let tijdStr = nu.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    let datumTijdStr = `${datumStr} ${tijdStr}`;

    let nieuweInvoer = {
        id: Date.now(),
        naam: naam,
        tijdstip: datumTijdStr,
        items: JSON.parse(JSON.stringify(huidigeBon)),
        totaal: totaalBedrag.toFixed(2)
    };

    openstaande.push(nieuweInvoer);
    localStorage.setItem('open_rekeningen', JSON.stringify(openstaande));
    wisHuidigeBon();
    laadOpenstaandeRekeningen();
}

// --- EINDE MODAL BEHEER ---

function laadOpenstaandeRekeningen() {
    let tbody = document.getElementById('openRekeningenBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];

    let tafels = {};
    openstaande.forEach((rek) => {
        if (!tafels[rek.naam]) {
            tafels[rek.naam] = { bestellingen: [], totaalBedrag: 0 };
        }
        tafels[rek.naam].bestellingen.push(rek);
        tafels[rek.naam].totaalBedrag += parseFloat(rek.totaal);
    });

    let aantalOpen = Object.keys(tafels).length;
    let badgeEl = document.getElementById('openCountBadge');
    if (badgeEl) {
        if (aantalOpen > 0) {
            badgeEl.innerText = aantalOpen;
            badgeEl.style.display = 'inline-block';
        } else {
            badgeEl.style.display = 'none';
        }
    }

    if (openstaande.length === 0) return;

    for (let naam in tafels) {
        let tafelData = tafels[naam];

        tafelData.bestellingen.forEach((rek) => {
            let itemList = rek.items.map(i => `${i.aantal}x ${i.naam}`).join(', ');
            let globalIndex = openstaande.findIndex(item => item.id === rek.id);

            let row = `<tr>
                <td><strong>${rek.naam}</strong></td>
                <td>${rek.tijdstip}</td>
                <td>${itemList}</td>
                <td>&euro; ${rek.totaal}</td>
                <td>
                    <button class="btn btn-danger btn-small" onclick="verwijderOpenstaandeRegel(${globalIndex})" title="Verwijder deze regel">X</button>
                </td>
            </tr>`;
            tbody.innerHTML += row;
        });

        let totaalTafelBedrag = tafelData.totaalBedrag.toFixed(2);
        let totalRow = `<tr class="total-row">
            <td colspan="3">Totaal te betalen voor <strong>${naam}</strong></td>
            <td>&euro; ${totaalTafelBedrag}</td>
            <td>
                <button class="btn btn-primary btn-small" onclick="vraagBetaalmethodeTafel('${naam}')">Afrekenen</button>
            </td>
        </tr>`;
        tbody.innerHTML += totalRow;
    }
}

function verwijderOpenstaandeRegel(index) {
    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    let rek = openstaande[index];

    if (confirm(`Weet je zeker dat je deze bestelling van "${rek.naam}" (&euro; ${rek.totaal}) wilt verwijderen?`)) {
        openstaande.splice(index, 1);
        localStorage.setItem('open_rekeningen', JSON.stringify(openstaande));
        laadOpenstaandeRekeningen();
    }
}

function slaBestellingOpInGeschiedenis(itemsArray, bronInfo, betaalmethode) {
    let totaalBedrag = itemsArray.reduce((sum, item) => sum + (item.prijs * item.aantal), 0);

    let nu = new Date();
    let datumStr = nu.toLocaleDateString('nl-NL', { day: '2-digit', month: '2-digit', year: 'numeric' });
    let tijdStr = nu.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    let bestelling = {
        datum: datumStr,
        tijdstip: tijdStr,
        tafelNaam: bronInfo,
        items: [...itemsArray],
        totaal: totaalBedrag.toFixed(2),
        betaalmethode: betaalmethode || 'Onbekend'
    };

    let geschiedenis = JSON.parse(localStorage.getItem('kassa_bestellingen')) || [];
    geschiedenis.unshift(bestelling);
    localStorage.setItem('kassa_bestellingen', JSON.stringify(geschiedenis));

    laadGeschiedenis();
}

function laadGeschiedenis() {
    let tbody = document.getElementById('geschiedenisBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    let geschiedenis = JSON.parse(localStorage.getItem('kassa_bestellingen')) || [];

    geschiedenis.forEach(b => {
        let itemList = b.items.map(i => `${i.aantal}x ${i.naam}`).join(', ');
        let tafelInfo = b.tafelNaam || "Directe Verkoop";
        let datumVal = b.datum || "-";
        let tijdVal = b.tijdstip || "-";
        let methodeVal = b.betaalmethode || "-";

        let row = `<tr>
            <td>${datumVal}</td>
            <td>${tijdVal}</td>
            <td><strong>${tafelInfo}</strong></td>
            <td>${itemList}</td>
            <td>&euro; ${b.totaal}</td>
            <td>${methodeVal}</td>
        </tr>`;
        tbody.innerHTML += row;
    });
}

function wisGeschiedenis() {
    if (confirm("Alle geschiedenis wissen?")) {
        localStorage.removeItem('kassa_bestellingen');
        laadGeschiedenis();
    }
}

window.onload = function() {
    laadProducten();
    laadOpenstaandeRekeningen();
    laadGeschiedenis();
};