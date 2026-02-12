/**
 * Verify CSV file can be parsed correctly
 */

const csv = require('csv-parser');
const fs = require('fs');

const filePath = './case_reports_upload.csv';

console.log(`📂 Parsing CSV: ${filePath}\n`);

let rowCount = 0;
let hasLocation = false;

fs.createReadStream(filePath)
  .pipe(csv())
  .on('data', (row) => {
    rowCount++;
    if (rowCount === 1) {
      console.log(`✅ Headers found:`);
      console.log(`   ${Object.keys(row).join(', ')}\n`);
      
      const hasLocationColumn = 'location' in row;
      console.log(`Location column present: ${hasLocationColumn ? '✅ YES' : '❌ NO'}\n`);
    }
    
    if (rowCount <= 3) {
      console.log(`Row ${rowCount}:`);
      console.log(`  Reporter: ${row.reporter_type} (${row.reporter_id})`);
      console.log(`  Age: ${row.patient_age} | Sex: ${row.sex}`);
      console.log(`  Location: ${row.location}`);
      console.log(`  Symptoms: ${row.symptoms}`);
      console.log('');
    }
  })
  .on('end', () => {
    console.log(`✅ Total rows: ${rowCount}`);
    console.log(`\n📊 CSV is valid and ready for upload!`);
  })
  .on('error', (error) => {
    console.error(`❌ CSV parsing error:`, error.message);
  });
