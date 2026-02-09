
const { execSync } = require('child_process');
try {
  const res = execSync('psql -U postgres -d postgres -c "SELECT * FROM thread_participants WHERE thread_id = \'9fcf79a7-28e4-49dd-8473-96fd3c0bf53c\';"');
  console.log(res.toString());
} catch (e) {
  console.error('Error executing psql:', e.message);
}
