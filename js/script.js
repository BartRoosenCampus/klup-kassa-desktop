let huidigeBon = [];
let beschikbareProducten = [];
let actieveCategorie = 'Alle';

// 1. Producten inladen uit producten.json
async function laadProducten() {
    try {
        let response = await fetch('json/producten.json');
        if (!response.ok) throw new Error('Kon producten.json niet laden');
        beschikbareProducten = await response.json();

        bouwCategorieFilters();
        bouwProductKnoppen();
    } catch (error) {
        alert("Let op: Kan 'producten.json' niet laden via directe bestandstoegang. Gebruik een lokale server (zoals Live Server in VS Code).");
        console.error(error);
    }
}

// 2. Categorie filterknoppen genereren
function bouwCategorieFilters() {
    let filterContainer = document.getElementById('categorieFilter');
    filterContainer.innerHTML = '';

    let categorieen = ['Alle', ...new Set(beschikbareProducten.map(p => p.categorie))];

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

// 3. Productknoppen genereren
function bouwProductKnoppen() {
    let grid = document.getElementById('productGrid');
    grid.innerHTML = '';

    let gefilterd = actieveCategorie === 'Alle'
        ? beschikbareProducten
        : beschikbareProducten.filter(p => p.categorie === actieveCategorie);

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

// Direct afrekenen
function directAfrekenen() {
    if (huidigeBon.length === 0) {
        alert("De bon is leeg!");
        return;
    }
    slaBestellingOpInGeschiedenis(huidigeBon, "Directe Verkoop");
    wisHuidigeBon();
}

// --- MODAL / POP-UP BEHEER VOOR NAMEN ---

function openNaamModal() {
    if (huidigeBon.length === 0) {
        alert("De bon is leeg!");
        return;
    }

    let selectEl = document.getElementById('bestaandeNamenSelect');
    selectEl.innerHTML = '<option value="">-- Kies bestaande --</option>';

    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    let uniekeNamen = [...new Set(openstaande.map(r => r.naam))];

    uniekeNamen.forEach(naam => {
        let opt = document.createElement('option');
        opt.value = naam;
        opt.innerText = naam;
        selectEl.appendChild(opt);
    });

    document.getElementById('nieuweNaamInput').value = '';
    document.getElementById('naamModal').style.display = 'flex';
}

function sluitNaamModal() {
    document.getElementById('naamModal').style.display = 'none';
}

function bevestigNaamEnBewaar() {
    let gekozenDropdown = document.getElementById('bestaandeNamenSelect').value;
    let getypteNaam = document.getElementById('nieuweNaamInput').value.trim();

    let naam = getypteNaam !== "" ? getypteNaam : gekozenDropdown;

    if (!naam || naam === "") {
        alert("Kies een bestaande naam of typ een nieuwe in!");
        return;
    }

    sluitNaamModal();
    bewaarOpNaam(naam);
}

function bewaarOpNaam(naam) {
    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    let totaalBedrag = huidigeBon.reduce((sum, i) => sum + (i.prijs * i.aantal), 0);

    let nieuweInvoer = {
        id: Date.now(),
        naam: naam,
        tijdstip: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        items: JSON.parse(JSON.stringify(huidigeBon)),
        totaal: totaalBedrag.toFixed(2)
    };

    openstaande.push(nieuweInvoer);
    localStorage.setItem('open_rekeningen', JSON.stringify(openstaande));
    wisHuidigeBon();
    laadOpenstaandeRekeningen();
}

// --- EINDE MODAL BEHEER ---

// Laad openstaande rekeningen gebundeld per tafel (volledig zichtbaar zonder scrollbalk)
function laadOpenstaandeRekeningen() {
    let tbody = document.getElementById('openRekeningenBody');
    tbody.innerHTML = '';

    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    if (openstaande.length === 0) return;

    let tafels = {};
    openstaande.forEach((rek) => {
        if (!tafels[rek.naam]) {
            tafels[rek.naam] = { bestellingen: [], totaalBedrag: 0 };
        }
        tafels[rek.naam].bestellingen.push(rek);
        tafels[rek.naam].totaalBedrag += parseFloat(rek.totaal);
    });

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
                <button class="btn btn-primary btn-small" onclick="rekenAfHeleRekening('${naam}')">Afrekenen</button>
            </td>
        </tr>`;
        tbody.innerHTML += totalRow;
    }
}

// Specifieke openstaande regel verwijderen
function verwijderOpenstaandeRegel(index) {
    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    let rek = openstaande[index];

    if (confirm(`Weet je zeker dat je deze bestelling van "${rek.naam}" (&euro; ${rek.totaal}) wilt verwijderen?`)) {
        openstaande.splice(index, 1);
        localStorage.setItem('open_rekeningen', JSON.stringify(openstaande));
        laadOpenstaandeRekeningen();
    }
}

// Volledige rekening van een naam/tafel in 1 keer afrekenen
function rekenAfHeleRekening(naam) {
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

    if (confirm(`Hele rekening van "${naam}" (&euro; ${totaalBedrag.toFixed(2)}) in één keer afrekenen?`)) {
        slaBestellingOpInGeschiedenis(alleGecombineerdeItems, `Tafel/Naam: ${naam}`);

        let overgebleven = openstaande.filter(r => r.naam !== naam);
        localStorage.setItem('open_rekeningen', JSON.stringify(overgebleven));

        laadOpenstaandeRekeningen();
    }
}

// Sla op in geschiedenis
function slaBestellingOpInGeschiedenis(itemsArray, bronInfo) {
    let totaalBedrag = itemsArray.reduce((sum, item) => sum + (item.prijs * item.aantal), 0);

    let bestelling = {
        tijdstip: `${bronInfo} (${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`,
        items: [...itemsArray],
        totaal: totaalBedrag.toFixed(2)
    };

    let geschiedenis = JSON.parse(localStorage.getItem('kassa_bestellingen')) || [];
    geschiedenis.unshift(bestelling);
    localStorage.setItem('kassa_bestellingen', JSON.stringify(geschiedenis));

    laadGeschiedenis();
}

// Laad geschiedenis
function laadGeschiedenis() {
    let tbody = document.getElementById('geschiedenisBody');
    tbody.innerHTML = '';

    let geschiedenis = JSON.parse(localStorage.getItem('kassa_bestellingen')) || [];

    geschiedenis.forEach(b => {
        let itemList = b.items.map(i => `${i.aantal}x ${i.naam}`).join(', ');
        let row = `<tr>
            <td>${b.tijdstip}</td>
            <td>${itemList}</td>
            <td>&euro; ${b.totaal}</td>
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

// Startapplicatie
window.onload = function() {
    laadProducten();
    laadOpenstaandeRekeningen();
    laadGeschiedenis();
};