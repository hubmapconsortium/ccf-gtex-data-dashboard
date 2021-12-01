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

function resultsAsDatasets(results) {
  const data = results['@graph'];
  const items = { };
  const locationItems = [];

  for (const donor of data) {
    const id = donor['@id'];
    if (!items[id]) { 
      items[id] = {
        donor: Object.assign({}, donor, {samples: undefined, datasets: undefined}),
        blocks: [],
        sections: [],
        datasets: []
      };
    }

    const item = items[id];
    item.datasets = item.datasets.concat(donor.datasets || []);
    for (const block of (donor.samples || [])) {
      item.blocks.push(Object.assign({}, block, {samples: undefined, datasets: undefined, rui_location: undefined}));
      item.datasets = item.datasets.concat(block.datasets || []);

      if (block.sections && block.sections.length > 0) {
        for (const section of block.sections) {
          item.sections.push(Object.assign({}, section, {samples: undefined, datasets: undefined}));
          item.datasets = item.datasets.concat(section.datasets || []);
          locationItems.push({
            donor, rui_location: block.rui_location, block, section, datasets: [...donor.datasets || [], ...block.datasets, ...section.datasets]
          });
        }
      } else {
        locationItems.push({
          donor, rui_location: block.rui_location, block, section: false, datasets: [...donor.datasets || [], ...block.datasets]
        });
      }
    }
  }

  const csvItems = locationItems.map(row => {
    return {
      donor: row.donor.link,
      age: row.donor.age,
      sex: row.donor.sex,
      bmi: row.donor.bmi,
      provider: (row.donor.provider_name || 'General Electric').replace(/TMC-/, ''),
      block: row.block.link,
      section_count: row.block.section_count,
      section_size: row.block.section_size,
      section: row.section ? row.section.link : '',
      section_number: row.section ? row.section.section_number : '',
      location: row.rui_location['@id'],
      x_dimension: row.rui_location.x_dimension,
      y_dimension: row.rui_location.y_dimension,
      z_dimension: row.rui_location.z_dimension,
      ref_organ: '#' + row.rui_location.placement.target.split('#')[1].replace(/\_Patch|CC1|CC2|CC3/g, ''),
      organ: row.rui_location.placement.target.split('#')[1].slice(3).replace(/\_Patch|CC1|CC2|CC3|Left|Right/g, '').replace('Colon', 'Lg Intestine'),
      num_as: (row.rui_location.ccf_annotations || []).length,
      datasets: row.datasets.map(d => d.link).join('; '),
      dataset_count: row.datasets.length,
      technologies: [ ...new Set(row.datasets.map(d => d.technology))].sort().join('; ')
    };
  });

  const stats = {
    numBlocks: new Set(),
    numSections: new Set(),
    numRuiLocations: new Set()
  };
  for (const item of csvItems) {
    stats.numBlocks.add(item.block);
    stats.numSections.add(item.section);
    stats.numRuiLocations.add(item.location);
  }
  stats.numBlocks = stats.numBlocks.size;
  stats.numSections = stats.numSections.size;
  stats.numRuiLocations = stats.numRuiLocations.size;

  return { data, locationItems, csvItems, stats };
}

let table;
function downloadTable() {
  if (table) {
    table.download("csv", "data.csv");
  }
}

function main() {
  let searchUri = 'https://hubmap-link-api.herokuapp.com/hubmap-datasets?format=jsonld';
  if (localStorage.getItem('HUBMAP_KEY')) {
    searchUri = `${searchUri}&token=${localStorage.getItem('HUBMAP_KEY')}`;
  }

  Promise.all([
    fetch("vis.vl.json").then((result) => result.json()),
    fetch(searchUri).then((result) => result.ok ? result.json() : invalidKey())
  ]).then(([spec, jsonData]) => {
    // Embed the graph data in the spec for ease of use from Vega Editor
    spec.datasets = resultsAsDatasets(jsonData);
    const stats = spec.datasets.stats;
    console.log(spec.datasets);
    spec.vconcat[1].hconcat[0].encoding.x.title += ` (${stats.numBlocks} Total)`;
    spec.vconcat[1].hconcat[1].encoding.x.title += ` (${stats.numSections} Total)`;
    spec.vconcat[1].hconcat[2].encoding.x.title += ` (${stats.numRuiLocations} Total)`;

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
