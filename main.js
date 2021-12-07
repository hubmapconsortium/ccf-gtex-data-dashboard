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

function resultsAsDatasets(jsonData, asctbAPI, versions) {
  const sheetOptions = versions.sheetOptions;
  const nodes = asctbAPI.data.nodes;
  const csvItems = [];
  jsonData.tissueInfo.forEach(tissueInfo => {
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

function getOrganUris(config) {
  const organUris = [];
  for (const organ of config.sheetDetails) {
    if (organ.version) {
      for (const version of organ.version) {
        let asctbAPIUri = `https://asctb-api.herokuapp.com/v2/csv?csvUrl=https://docs.google.com/spreadsheets/d/${version.sheetId}/export?format=csv%26gid=${version.gid}&output=graph`;
        organUris.push(asctbAPIUri)
      }
    }
  }
  return organUris;
}

function matchingData(result, csvItems) {
  let matches = [];
  matches = csvItems.filter(item => item['ASCT+B Table'] !== 'No matches')
  return matches
}

function main() {
  let searchUri = 'https://gtexportal.org/rest/v1/dataset/tissueInfo?datasetId=gtex_v8&format=json';

  Promise.all([
    fetch("https://hubmapconsortium.github.io/ccf-gtex-data-dashboard/vis.vl.json").then((result) => result.json()),
    fetch(searchUri).then((result) => result.ok ? result.json() : invalidKey()),
    fetch("https://hubmapconsortium.github.io/ccf-gtex-data-dashboard/sheet-config.json").then((result) => result.json()),
    fetch("https://hubmapconsortium.github.io/ccf-gtex-data-dashboard/versions.json").then((result) => result.json()),
  ]).then(([spec, jsonData, config, versions]) => {
    const organUris = getOrganUris(config)
    let x = [];
    for (const uri of organUris) {
      x.push(fetch(uri).then((result) => result.ok ? result.json() : invalidKey()))
    }
    
    Promise.all(x).then((allSets) => {
      console.log(allSets)
      let result = [];
      let seen = new Set;
      for (const dataset of allSets) {
        console.log(result)
        const csvItems = resultsAsDatasets(jsonData, dataset, versions).csvItems
        console.log(matchingData(result, csvItems))
        const matches = matchingData(result, csvItems)
        if (matches.length > 0) {
          console.log(seen)
          console.log(matches[0]['GTEx Ontology ID'])
          if (!seen.has(matches[0]['GTEx Ontology ID'])) {
            result = result.concat(matches)
            seen.add(matches[0]['GTEx Ontology ID'])
            console.log(result)
            console.log(seen)
          }
        }
        result = result.concat(csvItems)
      }
      let unique = [...new Set(result)];
      unique.sort((a, b) => (a['ASCT+B Table'] === 'No matches') ? 1 : -1)
      return unique
    }).then((result) => {
      // console.log(result.slice(10))
      table = new Tabulator("#table", {
        data: result,
        autoColumns: true
      });
      // Embed the graph data in the spec for ease of use from Vega Editor
      return vegaEmbed("#visualization", spec, { "renderer": "svg", "actions": true });
    }).then((results) => {
      console.log("Visualization successfully loaded");
    });
  })}
main();
