/* jshint esversion: 6 */

function setApiKey() {
  const apiKey = prompt('Enter API Key (leave blank to clear)', '');
  localStorage.removeItem('HUBMAP_KEY');
  if (apiKey.trim().length > 0) {
    localStorage.setItem('HUBMAP_KEY', apiKey);
  }
  location.reload();
}

function invalidKey() {
  if (localStorage.getItem('HUBMAP_KEY') !== null) {
    localStorage.removeItem('HUBMAP_KEY');
    alert('An invalid/stale key was found. Clearing key and refreshing the page');
    location.reload();
  } else {
    throw new Error('Something went wrong with the API request!');
  }
}

function resultsAsDatasets(results, asctbAPI, versions) {
  const sheetOptions = versions.sheetOptions;
  const nodes = asctbAPI.data.nodes;
  const csvItems = [];
  results.tissueInfo.forEach(tissueInfo => {
    const uberonId = tissueInfo.uberonId;
    const match = nodes.find(node => node.metadata.ontologyId === `UBERON:${uberonId}`);
    const matchingEntry = sheetOptions.find(entry => entry.title === tissueInfo.tissueSite);
    const csvItem = {
      "GTEx Ontology ID": `UBERON:${uberonId}`,
      "GTEx Tissue Site": tissueInfo.tissueSite || 'No matches',
      "Ontology term": match ? match.metadata.label : 'No matches',
      "ASCT+B Table": 'No matches'
    };
    if (matchingEntry && match) {
      for (const version of matchingEntry.version) {
        csvItems.push({ ...csvItem, "ASCT+B Table": version.value })
      }
    } else {
      csvItems.push(csvItem);
    }
  });

  return { csvItems };
}

let table;
function downloadTable() {
  if (table) {
    table.download("csv", "data.csv");
  }
}

function main() {
  let searchUri = 'https://gtexportal.org/rest/v1/dataset/tissueInfo?datasetId=gtex_v8&format=json';
  let asctbAPIUri = 'https://asctb-api.herokuapp.com/v2/csv?csvUrl=https://docs.google.com/spreadsheets/d/1tK916JyG5ZSXW_cXfsyZnzXfjyoN-8B2GXLbYD6_vF0/export?format=csv%26gid=2137043090&output=graph';
  if (localStorage.getItem('HUBMAP_KEY')) {
    searchUri = `${searchUri}&token=${localStorage.getItem('HUBMAP_KEY')}`;
  }

  Promise.all([
    fetch("https://hubmapconsortium.github.io/ccf-gtex-data-dashboard/vis.vl.json").then((result) => result.json()),
    fetch(searchUri).then((result) => result.ok ? result.json() : invalidKey()),
    fetch(asctbAPIUri).then((result) => result.ok ? result.json() : invalidKey()),
    fetch("https://hubmapconsortium.github.io/ccf-gtex-data-dashboard/versions.json").then((result) => result.json()),
  ]).then(([spec, jsonData, asctbAPI, versions]) => {
    // Embed the graph data in the spec for ease of use from Vega Editor
    spec.datasets = resultsAsDatasets(jsonData, asctbAPI, versions);
    table = new Tabulator("#table", {
      data: spec.datasets.csvItems,
      autoColumns: true
    });

    return vegaEmbed("#visualization", spec, { "renderer": "svg", "actions": true });
  }).then((results) => {
    console.log("Visualization successfully loaded");
  });
}
main();
