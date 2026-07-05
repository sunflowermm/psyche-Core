const { version } = await fetch('./version.json', { cache: 'no-store' }).then((r) => r.json())
const key = 'psyche-web-ver'
const prev = localStorage.getItem(key)
if (prev && prev !== version) {
  localStorage.setItem(key, version)
  location.replace(`${location.pathname}?v=${encodeURIComponent(version)}${location.hash}`)
} else {
  localStorage.setItem(key, version)
}
globalThis.__PSYCHE_VER__ = version
const link = document.createElement('link')
link.rel = 'stylesheet'
link.href = `./app.css?v=${encodeURIComponent(version)}`
document.head.appendChild(link)
await import(`./app.js?v=${encodeURIComponent(version)}`)
