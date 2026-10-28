let huidigeBon = [];
let beschikbareProducten = [];
let actieveCategorie = 'Alle';

let pendingAfrekening = null;

function getProductCategories(prod) {
    if (Array.isArray(prod.categorie)) {
        return prod.categorie;
    } else if (prod.categorie) {
        return [prod.categorie];
    }
    return [];
}

async function laadProducten() {
    try {
        let response = await fetch('json/producten.json');
        if (!response.ok) throw new Error('Kon producten.json niet laden');
        beschikbareProducten = await response.json();

        bouwCategorieFilters();
        bouwProductKnoppen();
    } catch (error) {
        console.error(error);
    }
}

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

function voegToe(naam, prijs) {
    let bestaandItem = huidigeBon.find(item => item.naam === naam);
    if (bestaandItem) {
        bestaandItem.aantal++;
    } else {
        huidigeBon.push({ naam: naam, prijs: prijs, aantal: 1 });
    }
    updateBonScherm();
}

function verwijderItem(naam) {
    huidigeBon = huidigeBon.filter(item => item.naam !== naam);
    updateBonScherm();
}

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

// --- BETAALMETHODE MODAL ---

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

// --- MODAL VOOR NIEUWE BESTELLING OP NAAM ---

function openNaamModal() {
    if (huidigeBon.length === 0) {
        alert("De bon is leeg!");
        return;
    }

    let containerEl = document.getElementById('bestaandeNamenKnoppen');
    if (!containerEl) return;
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
            btn.addEventListener('click', () => {
                sluitNaamModal();
                bewaarOpNaam(naam);
            });
            containerEl.appendChild(btn);
        });
    }

    document.getElementById('nieuweNaamInput').value = '';
    document.getElementById('naamModal').style.display = 'flex';
}

function sluitNaamModal() {
    let modal = document.getElementById('naamModal');
    if (modal) modal.style.display = 'none';
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

// --- DYNAMISCH GEGENEREERDE MODAL VOOR "ZET OP..." ---

function openHernoemModal(globalIndex) {
    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    let rek = openstaande[globalIndex];
    if (!rek) return;

    // Verwijder eventuele oude dynamische modal mocht die er nog zijn
    let oudeModal = document.getElementById('dynamischHernoemModal');
    if (oudeModal) oudeModal.remove();

    // Maak de modal overlay container aan
    let modal = document.createElement('div');
    modal.id = 'dynamischHernoemModal';
    modal.className = 'modal';
    modal.style.display = 'flex';

    // Inhoud van de modal
    let content = document.createElement('div');
    content.className = 'modal-content';

    let title = document.createElement('h3');
    title.innerText = 'Zet op andere naam / tafel';
    content.appendChild(title);

    let info = document.createElement('p');
    info.style.fontSize = '14px';
    info.style.color = 'var(--text-muted)';
    info.style.marginBottom = '15px';
    info.innerText = `Bestelling van "${rek.naam}" (€ ${rek.totaal}) verplaatsen als nieuwe regel naar:`;
    content.appendChild(info);

    // Groep voor bestaande namen knoppen
    let group1 = document.createElement('div');
    group1.className = 'form-group';
    let label1 = document.createElement('label');
    label1.innerText = 'Kies bestaande naam / tafel:';
    group1.appendChild(label1);

    let btnGrid = document.createElement('div');
    btnGrid.className = 'modal-btn-grid';

    let uniekeNamen = [...new Set(openstaande.map(r => r.naam))].filter(n => n !== rek.naam);

    if (uniekeNamen.length === 0) {
        btnGrid.innerHTML = '<span style="font-size: 13px; color: var(--text-muted);">Geen andere openstaande rekeningen</span>';
    } else {
        uniekeNamen.forEach(naam => {
            let btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'btn';
            btn.innerText = naam;
            // Direct event listener toevoegen bij creatie
            btn.addEventListener('click', () => {
                verplaatsNaarNaam(globalIndex, naam);
                modal.remove();
            });
            btnGrid.appendChild(btn);
        });
    }
    group1.appendChild(btnGrid);
    content.appendChild(group1);

    // Scheidingsteken 'OF'
    let sep = document.createElement('div');
    sep.style.cssText = 'text-align: center; margin: 15px 0; font-weight: bold; color: #aaa;';
    sep.innerText = 'OF';
    content.appendChild(sep);

    // Groep voor nieuwe naam invoeren
    let group2 = document.createElement('div');
    group2.className = 'form-group';
    let label2 = document.createElement('label');
    label2.innerText = 'Nieuwe naam / tafel invoeren:';
    group2.appendChild(label2);

    let inputRow = document.createElement('div');
    inputRow.style.cssText = 'display: flex; gap: 8px;';

    let input = document.createElement('input');
    input.type = 'text';
    input.className = 'form-control';
    input.placeholder = 'Bijv. Tafel 5 of Jan';
    inputRow.appendChild(input);

    let saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-primary';
    saveBtn.style.flex = '0 0 100px';
    saveBtn.innerText = 'Verplaats';
    saveBtn.addEventListener('click', () => {
        let nieuweNaam = input.value.trim();
        if (!nieuweNaam) {
            alert('Typ een nieuwe naam of tafel in!');
            return;
        }
        verplaatsNaarNaam(globalIndex, nieuweNaam);
        modal.remove();
    });
    inputRow.appendChild(saveBtn);
    group2.appendChild(inputRow);
    content.appendChild(group2);

    // Annuleren knop
    let actions = document.createElement('div');
    actions.className = 'actions';
    actions.style.marginTop = '20px';

    let cancelBtn = document.createElement('button');
    cancelBtn.className = 'btn btn-danger full-width';
    cancelBtn.innerText = 'Annuleren';
    cancelBtn.addEventListener('click', () => {
        modal.remove();
    });
    actions.appendChild(cancelBtn);
    content.appendChild(actions);

    modal.appendChild(content);
    document.body.appendChild(modal);
}

function verplaatsNaarNaam(index, nieuweNaam) {
    let openstaande = JSON.parse(localStorage.getItem('open_rekeningen')) || [];
    let teVerplaatsenRekening = openstaande[index];

    if (!teVerplaatsenRekening) return;

    // Verander de naam van deze specifieke regel, zodat deze als nieuwe losse lijn onder de doelnaam komt te staan
    teVerplaatsenRekening.naam = nieuweNaam;

    localStorage.setItem('open_rekeningen', JSON.stringify(openstaande));
    laadOpenstaandeRekeningen();
}

// --- OVERIGE FUNCTIES ---

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
                    <div style="display: flex; gap: 4px;">
                        <button class="btn btn-warning btn-small btn-zet-op" data-index="${globalIndex}" title="Verplaats naar andere naam/tafel">
                            Verplaats
                        </button>
                        <button class="btn btn-danger btn-small btn-verwijder-regel" data-index="${globalIndex}" title="Verwijder deze regel">
                            Verwijder
                        </button>
                    </div>
                </td>
            </tr>`;
            tbody.innerHTML += row;
        });

        let totaalTafelBedrag = tafelData.totaalBedrag.toFixed(2);
        let totalRow = `<tr class="total-row">
            <td colspan="3">Totaal te betalen voor <strong>${naam}</strong></td>
            <td>&euro; ${totaalTafelBedrag}</td>
            <td>
                <button class="btn btn-primary btn-small btn-afrekenen-tafel" data-naam="${naam}">Afrekenen</button>
            </td>
        </tr>`;
        tbody.innerHTML += totalRow;
    }

    // Event listeners dynamisch toevoegen aan de gegenereerde knoppen in de tabel
    document.querySelectorAll('.btn-zet-op').forEach(btn => {
        btn.addEventListener('click', (e) => {
            let index = parseInt(e.currentTarget.getAttribute('data-index'));
            openHernoemModal(index);
        });
    });

    document.querySelectorAll('.btn-verwijder-regel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            let index = parseInt(e.currentTarget.getAttribute('data-index'));
            verwijderOpenstaandeRegel(index);
        });
    });

    document.querySelectorAll('.btn-afrekenen-tafel').forEach(btn => {
        btn.addEventListener('click', (e) => {
            let naam = e.currentTarget.getAttribute('data-naam');
            vraagBetaalmethodeTafel(naam);
        });
    });
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