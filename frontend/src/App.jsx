import { useEffect, useMemo, useRef, useState } from 'react'
import Plotly from 'plotly.js-dist-min'
import createPlotlyComponent from 'react-plotly.js/factory'
import './App.css'

const Plot = createPlotlyComponent(Plotly)
const API = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? '' : 'http://127.0.0.1:8000')

const CHART = {
  paper: 'rgba(0, 0, 0, 0)',
  plot: '#0b1424',
  text: '#9aabc2',
  grid: 'rgba(129, 158, 196, 0.12)',
  marker: '#58a6d8',
  selected: '#f3f7ff',
  selectedRing: '#9b7cff',
  earth: '#f6c667',
  jupiter: '#e39b4a',
  spike: 'rgba(154, 176, 204, 0.42)',
}

const REFERENCES = [
  { name: 'Earth', mass: 1, period: 365.25, color: CHART.earth },
  { name: 'Jupiter', mass: 317.8, period: 4332.59, color: CHART.jupiter },
]

function formatNumber(n) {
  if (n == null || Number.isNaN(Number(n))) return '—'
  const value = Number(n)
  const digits = value >= 100 ? 1 : value >= 1 ? 2 : 3
  return value.toLocaleString(undefined, { maximumFractionDigits: digits })
}

function periodContext(days) {
  if (!days) return ''
  if (days < 1) return `${formatNumber(days * 24)} Earth hours`
  if (days < 365.25) return `${formatNumber(days / 365.25)} Earth years`
  return `${formatNumber(days / 365.25)} Earth years`
}

function SearchIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  )
}

function SparkleIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 2c.5 5.4 2.6 7.5 8 8-5.4.5-7.5 2.6-8 8-.5-5.4-2.6-7.5-8-8 5.4-.5 7.5-2.6 8-8Z" />
      <path d="M19 16c.2 2 1 2.8 3 3-2 .2-2.8 1-3 3-.2-2-1-2.8-3-3 2-.2 2.8-1 3-3Z" />
    </svg>
  )
}

function App() {
  const searchInputRef = useRef(null)
  const [planets, setPlanets] = useState([])
  const [selectedPlanet, setSelectedPlanet] = useState('')
  const [aiSummary, setAiSummary] = useState('')
  const [loadingPlanets, setLoadingPlanets] = useState(true)
  const [loadingAi, setLoadingAi] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [aiError, setAiError] = useState('')
  const [query, setQuery] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [highlightIndex, setHighlightIndex] = useState(0)

  useEffect(() => {
    fetch(`${API}/planets`)
      .then((res) => {
        if (!res.ok) throw new Error('The planet catalog could not be loaded.')
        return res.json()
      })
      .then((data) => {
        setPlanets(data)
        const featured = data.find((planet) => planet.pl_name === 'Kepler-22 b')
        if (data.length > 0) setSelectedPlanet(featured?.pl_name || data[0].pl_name)
      })
      .catch((err) => setCatalogError(err.message))
      .finally(() => setLoadingPlanets(false))
  }, [])

  const selected = useMemo(
    () => planets.find((planet) => planet.pl_name === selectedPlanet),
    [planets, selectedPlanet],
  )
  const selectedIndex = useMemo(
    () => planets.findIndex((planet) => planet.pl_name === selectedPlanet),
    [planets, selectedPlanet],
  )
  const catalog = useMemo(
    () => ({
      x: planets.map((planet) => planet.pl_bmasse),
      y: planets.map((planet) => planet.pl_orbper),
      text: planets.map((planet) => planet.pl_name),
    }),
    [planets],
  )
  const suggestions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    const matches = normalizedQuery
      ? planets.filter((planet) => planet.pl_name.toLowerCase().includes(normalizedQuery))
      : planets
    return matches.slice(0, 8)
  }, [planets, query])

  useEffect(() => {
    setHighlightIndex(0)
  }, [query, pickerOpen])

  useEffect(() => {
    function focusSearch(event) {
      const target = event.target
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable
      if (event.key === '/' && !isTyping) {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }

    window.addEventListener('keydown', focusSearch)
    return () => window.removeEventListener('keydown', focusSearch)
  }, [])

  function selectPlanet(name) {
    if (!name || name === selectedPlanet) return
    if (REFERENCES.some((reference) => reference.name === name)) return
    setSelectedPlanet(name)
    setQuery('')
    setPickerOpen(false)
    setHighlightIndex(0)
    setAiSummary('')
    setAiError('')
  }

  function generateAiAnalysis() {
    setLoadingAi(true)
    setAiSummary('')
    setAiError('')

    fetch(`${API}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ selectedPlanet }),
    })
      .then(async (res) => {
        if (res.status === 429) {
          throw new Error('Request limit reached. Try again in an hour.')
        }
        if (!res.ok) {
          const data = await res.json().catch(() => null)
          throw new Error(data?.detail || 'AI interpretation is unavailable right now.')
        }
        return res.json()
      })
      .then((data) => setAiSummary(data.aiSummary))
      .catch((err) => setAiError(err.message))
      .finally(() => setLoadingAi(false))
  }

  if (loadingPlanets) {
    return (
      <main className="loading-screen">
        <div className="brand-mark" aria-hidden="true">
          <span />
        </div>
        <p className="eyebrow">NASA Exoplanet Archive</p>
        <h1>Mapping distant worlds</h1>
        <div className="loading-track" aria-label="Loading the exoplanet catalog">
          <span />
        </div>
        <p className="loading-note">Waking the observatory and loading the catalog…</p>
      </main>
    )
  }

  if (catalogError) {
    return (
      <main className="status-screen">
        <p className="eyebrow">Connection interrupted</p>
        <h1>The observatory is temporarily offline.</h1>
        <p>{catalogError} If the API is waking up, try refreshing in a moment.</p>
        <button type="button" onClick={() => window.location.reload()}>
          Try again
        </button>
      </main>
    )
  }

  const activeSuggestion = suggestions[highlightIndex]
  const activeOptionId = activeSuggestion ? `planet-option-${highlightIndex}` : undefined

  return (
    <div className="app-shell">
      <div className="ambient-orbit ambient-orbit-one" aria-hidden="true" />
      <div className="ambient-orbit ambient-orbit-two" aria-hidden="true" />

      <header className="topbar">
        <a className="brand" href="/" aria-label="ExoScope home">
          <span className="brand-mark" aria-hidden="true">
            <span />
          </span>
          <span>ExoScope</span>
        </a>

        <div className="planet-picker">
          <label className="sr-only" htmlFor="planet-search">
            Search planets
          </label>
          <span className="search-icon">
            <SearchIcon />
          </span>
          <input
            ref={searchInputRef}
            id="planet-search"
            type="search"
            role="combobox"
            aria-expanded={pickerOpen}
            aria-controls="planet-suggestions"
            aria-autocomplete="list"
            aria-activedescendant={pickerOpen ? activeOptionId : undefined}
            placeholder="Search 6,000+ planets"
            value={pickerOpen ? query : ''}
            onFocus={() => {
              setPickerOpen(true)
              setQuery('')
            }}
            onBlur={() => {
              setPickerOpen(false)
              setQuery('')
              setHighlightIndex(0)
            }}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault()
                if (!pickerOpen) {
                  setPickerOpen(true)
                  return
                }
                if (suggestions.length > 0) {
                  setHighlightIndex((index) => (index + 1) % suggestions.length)
                }
              }
              if (event.key === 'ArrowUp') {
                event.preventDefault()
                if (pickerOpen && suggestions.length > 0) {
                  setHighlightIndex(
                    (index) => (index - 1 + suggestions.length) % suggestions.length,
                  )
                }
              }
              if (event.key === 'Enter' && suggestions[highlightIndex]) {
                event.preventDefault()
                selectPlanet(suggestions[highlightIndex].pl_name)
              }
              if (event.key === 'Escape') event.currentTarget.blur()
            }}
          />
          <span className="search-shortcut" aria-hidden="true">
            /
          </span>
          {pickerOpen && (
            <ul id="planet-suggestions" className="suggestions" role="listbox">
              {suggestions.length === 0 && (
                <li className="suggestion-empty">No matching worlds found</li>
              )}
              {suggestions.map((planet, index) => (
                <li key={planet.pl_name}>
                  <button
                    type="button"
                    id={`planet-option-${index}`}
                    role="option"
                    aria-selected={index === highlightIndex}
                    className={index === highlightIndex ? 'is-active' : undefined}
                    onMouseDown={(event) => event.preventDefault()}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => selectPlanet(planet.pl_name)}
                  >
                    <span>{planet.pl_name}</span>
                    <span className="suggestion-metrics">
                      {formatNumber(planet.pl_bmasse)} M⊕ · {formatNumber(planet.pl_orbper)} d
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </header>

      <main className="main-content">
        <section className="hero">
          <div>
            <p className="eyebrow">
              <span className="live-dot" aria-hidden="true" />
              NASA catalog · weekly snapshot
            </p>
            <h1>Explore worlds beyond our solar system.</h1>
            <p className="hero-copy">
              Compare the measured mass and orbital rhythm of confirmed exoplanets. Select any
              point to bring a distant world into focus.
            </p>
          </div>
          <div className="catalog-stat">
            <strong>{planets.length.toLocaleString()}</strong>
            <span>worlds mapped</span>
          </div>
        </section>

        <div className="dashboard-grid">
          <section className="panel chart-panel" aria-labelledby="chart-title">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Orbital atlas</p>
                <h2 id="chart-title">Mass × orbital period</h2>
              </div>
              <div className="chart-hint">
                <span className="hint-dot" />
                Each dot is a confirmed planet
              </div>
            </div>

            <div className="chart">
              <Plot
                data={[
                  {
                    x: catalog.x,
                    y: catalog.y,
                    text: catalog.text,
                    type: 'scattergl',
                    mode: 'markers',
                    marker: { size: 6, color: CHART.marker, opacity: 0.52 },
                    selectedpoints: selectedIndex >= 0 ? [selectedIndex] : [],
                    selected: {
                      marker: {
                        size: 14,
                        color: CHART.selected,
                        opacity: 1,
                        line: { width: 3, color: CHART.selectedRing },
                      },
                    },
                    unselected: {
                      marker: { opacity: 0.45 },
                    },
                    hovertemplate:
                      '<b>%{text}</b><br>%{x:,.3~g} Earth masses<br>%{y:,.3~g} days<extra></extra>',
                    showlegend: false,
                  },
                  ...REFERENCES.map((reference) => ({
                    x: [reference.mass],
                    y: [reference.period],
                    text: [reference.name],
                    type: 'scattergl',
                    mode: 'markers',
                    name: reference.name,
                    marker: {
                      size: 9,
                      color: reference.color,
                      symbol: 'diamond',
                      line: { width: 1, color: '#08111f' },
                    },
                    hovertemplate:
                      `<b>${reference.name}</b><br>${formatNumber(reference.mass)} Earth masses` +
                      `<br>${formatNumber(reference.period)} days<extra></extra>`,
                  })),
                ]}
                layout={{
                  paper_bgcolor: CHART.paper,
                  plot_bgcolor: CHART.plot,
                  font: { family: 'IBM Plex Sans, sans-serif', color: CHART.text, size: 11 },
                  hovermode: 'closest',
                  hoverdistance: 28,
                  spikedistance: 28,
                  hoverlabel: {
                    bgcolor: '#111d30',
                    bordercolor: '#5b7ea3',
                    align: 'left',
                    font: { color: '#f3f7ff', family: 'IBM Plex Sans, sans-serif', size: 12 },
                  },
                  xaxis: {
                    type: 'log',
                    title: { text: 'Planet mass · Earth masses', standoff: 14 },
                    gridcolor: CHART.grid,
                    zeroline: false,
                    color: CHART.text,
                    fixedrange: false,
                    showspikes: true,
                    spikemode: 'across',
                    spikesnap: 'cursor',
                    spikecolor: CHART.spike,
                    spikethickness: 1,
                    spikedash: 'dot',
                  },
                  yaxis: {
                    type: 'log',
                    title: { text: 'Orbital period · Earth days', standoff: 12 },
                    gridcolor: CHART.grid,
                    zeroline: false,
                    color: CHART.text,
                    fixedrange: false,
                    showspikes: true,
                    spikemode: 'across',
                    spikesnap: 'cursor',
                    spikecolor: CHART.spike,
                    spikethickness: 1,
                    spikedash: 'dot',
                  },
                  legend: {
                    orientation: 'h',
                    x: 0,
                    y: 1.08,
                    font: { size: 11, color: CHART.text },
                    bgcolor: 'rgba(0, 0, 0, 0)',
                  },
                  margin: { t: 48, r: 20, b: 64, l: 72 },
                  autosize: true,
                  showlegend: true,
                  // Pan mode steals marker clicks; use the modebar Pan tool when needed.
                  dragmode: false,
                  uirevision: 'orbital-atlas',
                }}
                onClick={(event) => {
                  const name = event.points?.[0]?.text
                  if (typeof name === 'string') selectPlanet(name)
                }}
                config={{
                  displaylogo: false,
                  responsive: true,
                  scrollZoom: true,
                  modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'],
                }}
                useResizeHandler
                style={{ width: '100%', height: '100%' }}
              />
            </div>

            <div className="chart-footer">
              <span>Both axes use logarithmic scales</span>
              <span>Scroll to zoom · Pan tool to drag</span>
            </div>
          </section>

          <aside className="panel planet-panel" aria-labelledby="selected-planet">
            <div className="planet-visual" aria-hidden="true">
              <div key={selectedPlanet} className="planet-stage">
                <div className="planet-glow" />
                <div className="planet-sphere" />
                <div className="planet-orbit">
                  <span />
                </div>
              </div>
            </div>

            <div className="planet-heading">
              <p className="section-kicker">Selected world</p>
              <h2 id="selected-planet">{selectedPlanet}</h2>
              <p>Measured values from the NASA composite catalog.</p>
            </div>

            <div className="metrics">
              <div className="metric">
                <span>Planet mass</span>
                <strong key={`${selectedPlanet}-mass`} className="metric-fade">
                  {formatNumber(selected?.pl_bmasse)}
                </strong>
                <small>Earth masses · M⊕</small>
              </div>
              <div className="metric">
                <span>Orbital period</span>
                <strong key={`${selectedPlanet}-period`} className="metric-fade">
                  {formatNumber(selected?.pl_orbper)}
                </strong>
                <small key={`${selectedPlanet}-period-context`} className="metric-fade">
                  {periodContext(selected?.pl_orbper)}
                </small>
              </div>
            </div>

            <section className="interpretation" aria-labelledby="interpretation-title">
              <div className="interpretation-heading">
                <span className="sparkle">
                  <SparkleIcon />
                </span>
                <div>
                  <p className="section-kicker">AI lens</p>
                  <h3 id="interpretation-title">Interpret this world</h3>
                </div>
              </div>
              <p className="interpretation-copy">
                Generate a short classification using only this planet’s measured mass and period.
              </p>

              {aiSummary ? (
                <div className="ai-summary" aria-live="polite">
                  <p>{aiSummary}</p>
                  <span>Speculative · GPT-4o mini</span>
                </div>
              ) : (
                <button
                  className="primary-button"
                  type="button"
                  onClick={generateAiAnalysis}
                  disabled={loadingAi || !selectedPlanet}
                >
                  <SparkleIcon />
                  {loadingAi ? 'Reading the signals…' : 'Generate interpretation'}
                </button>
              )}
              {aiError && (
                <p className="error" role="alert">
                  {aiError}
                </p>
              )}
            </section>
          </aside>
        </div>
      </main>

      <footer className="footer">
        <span>Data updated weekly from the NASA Exoplanet Archive</span>
        <a href="https://exoplanetarchive.ipac.caltech.edu/" target="_blank" rel="noreferrer">
          View source data <span aria-hidden="true">↗</span>
        </a>
      </footer>
    </div>
  )
}

export default App
