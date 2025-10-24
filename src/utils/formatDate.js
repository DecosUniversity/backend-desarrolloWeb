// Simple date formatter for emails: returns "DD/MM/YYYY HH:mm"
function pad(n){ return String(n).padStart(2, '0') }

function formatDateForEmail(input){
  if(!input) return '-'
  const d = (input instanceof Date) ? input : new Date(input)
  if (Number.isNaN(d.getTime())) return '-'
  const day = pad(d.getDate())
  const month = pad(d.getMonth() + 1)
  const year = d.getFullYear()
  const hours = pad(d.getHours())
  const minutes = pad(d.getMinutes())
  return `${day}/${month}/${year} ${hours}:${minutes}`
}

module.exports = formatDateForEmail
