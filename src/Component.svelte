<script>
	import { getContext } from 'svelte';
	import '@fullcalendar/core/locales-all';
	import FullCalendar from 'svelte-fullcalendar';
	import daygridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import listPlugin from '@fullcalendar/list';
	import { onMount } from 'svelte';
	import { langs, codeLang } from './lang';

	// Eingaben aus Budibase
	export let language;
	export let calendarEvent;

	export let mappingTitle;
	export let mappingDate; // Datumsfeld (z. B. "date" mit "5.11.2025" oder "2025-11-05")
	export let mappingStart;
	export let mappingEnd;

	export let mappingTitle2;
	export let mappingDate2;
	export let mappingStart2;
	export let mappingEnd2;

	export let dataProvider;
	export let dataProvider2;

	export let mappingColor;
	export let mappingColor2;

	export let allday;
	export let allday2;

	export let headerOptionsStart;
	export let headerOptionsCenter;
	export let headerOptionsEnd;

	// Ansicht umschalten (counts / events)
	export let viewMode = 'counts';

	// Schwellen & Farben (viel = grün, wenig = rot)
	export let thresholdMin = 1;
	export let thresholdMax = 6;
	export let colorMin = 'rgba(244,67,54,0.35)'; // <= Min
	export let colorNeutral = 'rgba(255,235,59,0.35)'; // zwischen Min/Max
	export let colorMax = 'rgba(76,175,80,0.35)'; // >= Max

	// Anzeige-Text
	export let displayTemplate = ''; // optional override
	export let displayTemplateSingular = 'Es ist {count} SINA-Gerät verfügbar';
	export let displayTemplatePlural = 'Es sind {count} SINA-Geräte verfügbar';

	// Debug in die Konsole
	export let debug = false;

	// State
	let eventsList = [];
	let eventsByDate = {};
	let countsByDate = {};

	// Robustes Datums-Parsing (DD.MM.YYYY [HH:MM[:SS]], YYYY-MM-DD, ISO, Timestamp)
	const parseToDate = (val) => {
		if (!val) return null;

		if (val instanceof Date) return isNaN(val) ? null : val;

		if (typeof val === 'number') {
			const d = new Date(val);
			return isNaN(d) ? null : d;
		}

		if (typeof val === 'string') {
			const s = val.trim();

			// DD.MM.YYYY HH:MM[:SS]
			const dmYhm = s.match(
				/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/
			);
			if (dmYhm) {
				const dd = parseInt(dmYhm[1], 10);
				const mm = parseInt(dmYhm[2], 10);
				const yyyy = parseInt(dmYhm[3], 10);
				const HH = dmYhm[4] ? parseInt(dmYhm[4], 10) : 0;
				const MI = dmYhm[5] ? parseInt(dmYhm[5], 10) : 0;
				const SS = dmYhm[6] ? parseInt(dmYhm[6], 10) : 0;
				const d = new Date(yyyy, mm - 1, dd, HH, MI, SS);
				return isNaN(d) ? null : d;
			}

			// DD.MM.YYYY
			const dmY = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
			if (dmY) {
				const dd = parseInt(dmY[1], 10);
				const mm = parseInt(dmY[2], 10);
				const yyyy = parseInt(dmY[3], 10);
				const d = new Date(yyyy, mm - 1, dd);
				return isNaN(d) ? null : d;
			}

			// YYYY-MM-DD
			const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
			if (iso) {
				const yyyy = parseInt(iso[1], 10);
				const mm = parseInt(iso[2], 10);
				const dd = parseInt(iso[3], 10);
				const d = new Date(yyyy, mm - 1, dd);
				return isNaN(d) ? null : d;
			}

			// Fallback
			const d = new Date(s);
			return isNaN(d) ? null : d;
		}

		return null;
	};

	const toISODate = (val) => {
		const d = parseToDate(val);
		if (!d) return null;
		const y = d.getFullYear();
		const m = String(d.getMonth() + 1).padStart(2, '0');
		const day = String(d.getDate()).padStart(2, '0');
		return `${y}-${m}-${day}`;
	};

	const addEventToBuckets = (ev) => {
		const key = toISODate(ev.start || ev.date);
		if (!key) return;
		if (!eventsByDate[key]) eventsByDate[key] = [];
		eventsByDate[key].push(ev);
		countsByDate[key] = (countsByDate[key] || 0) + 1;
	};

	const buildEvents = () => {
		eventsList = [];
		eventsByDate = {};
		countsByDate = {};

		const rejected = [];

		const pushRows = (rows, map) => {
			if (!rows) return;
			rows.forEach((row) => {
				const rawDate = row?.[map.date];
				const isoKey = toISODate(rawDate);
				if (!isoKey) {
					rejected.push({ rawDate, row });
					return;
				}

				const ev = {
					title: row?.[map.title],
					date: row?.[map.date],
					start: row?.[map.start],
					end: row?.[map.end],
					color: map.color ?? '#313131',
					event: row,
					allDay: map.allday,
				};
				eventsList.push(ev);
				addEventToBuckets(ev);
			});
		};

		pushRows(dataProvider?.rows, {
			title: mappingTitle,
			date: mappingDate,
			start: mappingStart,
			end: mappingEnd,
			color: mappingColor,
			allday,
		});
		pushRows(dataProvider2?.rows, {
			title: mappingTitle2,
			date: mappingDate2,
			start: mappingStart2,
			end: mappingEnd2,
			color: mappingColor2,
			allday: allday2,
		});

		if (debug) {
			console.group('[Calendar Debug]');
			console.log('countsByDate', countsByDate);
			if (rejected.length)
				console.warn('Rejected (date parse failed):', rejected.slice(0, 10));
			console.groupEnd();
		}
	};

	onMount(buildEvents);

	$: JSON.stringify({
		a: dataProvider?.rows,
		b: dataProvider2?.rows,
		m: {
			mappingTitle,
			mappingDate,
			mappingStart,
			mappingEnd,
			mappingTitle2,
			mappingDate2,
			mappingStart2,
			mappingEnd2,
		},
		t: { thresholdMin, thresholdMax },
		c: { colorMin, colorNeutral, colorMax },
		txt: { displayTemplate, displayTemplateSingular, displayTemplatePlural },
	}),
		buildEvents();

	const isAggregate = () => viewMode === 'counts';

	const baseOptions = {
		plugins: [daygridPlugin, listPlugin, timeGridPlugin],
		initialDate: new Date(),
		locale: language,
		dayMaxEvents: true,
		firstDay: 1,
		theme: true,
		...langs[codeLang(language)],
	};

	const makeCustomButtons = () => ({
		toggleView: {
			text: isAggregate() ? 'Events' : 'Anzahl',
			click: () => {
				viewMode = isAggregate() ? 'events' : 'counts';
			},
		},
	});

	const ensureEndToolbar = () => {
		const end = (headerOptionsEnd ?? '').trim();
		return end.length > 0
			? `${end},toggleView`
			: 'dayGridMonth,dayGridWeek,timeGridDay,toggleView';
	};

	const colorForCount = (count) => {
		if (count >= thresholdMax) return colorMax;
		if (count <= thresholdMin) return colorMin;
		return colorNeutral;
	};

	const startOfLocalDay = (d) =>
		new Date(d.getFullYear(), d.getMonth(), d.getDate());
	const isTodayLocal = (d) =>
		startOfLocalDay(d).getTime() === startOfLocalDay(new Date()).getTime();

	const formatDisplay = (dateObj, count) => {
		const iso = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
		const weekday = dateObj.toLocaleDateString(language || 'de', {
			weekday: 'short',
		});
		const dateHuman = dateObj.toLocaleDateString(language || 'de', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		});
		let template =
			displayTemplate && displayTemplate.trim()
				? displayTemplate
				: count === 1
					? displayTemplateSingular
					: displayTemplatePlural;
		return template
			.replaceAll('{count}', String(count))
			.replaceAll('{iso}', iso)
			.replaceAll('{weekday}', weekday)
			.replaceAll('{date}', dateHuman);
	};

	// Counts-Modus: Zelle einfärben & klickbar
	const dayCellDidMountAgg = (arg) => {
		const key = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date).padStart ? '' : ''}${String(arg.date.getDate()).padStart(2, '0')}`;
		// obiges war Mist – sauber:
		const keyClean = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date.getDate()).padStart(2, '0')}`;

		const count = countsByDate[keyClean] || 0;
		const bg = colorForCount(count);

		arg.el.style.background = bg || '';
		arg.el.style.borderRadius = '6px';

		if (isTodayLocal(arg.date)) {
			arg.el.classList.add('bbfc-today');
			arg.el.style.boxShadow = 'inset 0 0 0 3px rgba(0,0,0,0.45)';
		} else {
			arg.el.classList.remove('bbfc-today');
			arg.el.style.boxShadow = '';
		}

		arg.el.style.cursor = 'pointer';
		arg.el.setAttribute('role', 'button');
		arg.el.setAttribute('tabindex', '0');
		arg.el.title = count > 0 ? formatDisplay(arg.date, count) : '';

		const fire = () => {
			const events = eventsByDate[keyClean] || [];
			const payload = {
				date: keyClean,
				count: events.length,
				events,
				label: formatDisplay(new Date(keyClean), events.length),
				isToday: isTodayLocal(new Date(keyClean)),
			};
			calendarEvent({ value: payload, clickedDate: keyClean });
		};
		arg.el.addEventListener('click', fire);
		arg.el.addEventListener('keydown', (e) => {
			if (e.key === 'Enter' || e.key === ' ') {
				e.preventDefault();
				fire();
			}
		});
	};

	const dayCellContentAgg = (arg) => {
		const key = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date.getDate()).padStart(2, '0')}`;
		const count = countsByDate[key] || 0;
		const dayNum = arg.dayNumberText || '';
		const label = count > 0 ? formatDisplay(arg.date, count) : '';
		return {
			html: `
      <div class="bbfc-wrap">
        <div class="bbfc-daynum">${dayNum}</div>
        <div class="bbfc-center">${label ? `<span class="bbfc-label">${label}</span>` : ''}</div>
      </div>
    `,
		};
	};

	// Event-Ansicht
	const onEventClick = (ev) => {
		const start = ev?.event?.start;
		const clickedDate = start
			? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`
			: '';
		const rowId = ev?.event?.extendedProps?.event?._id || '';
		calendarEvent({ value: ev.event, rowId, clickedDate });
	};

	let options;
	$: options = {
		...baseOptions,
		headerToolbar: {
			start: headerOptionsStart,
			center: headerOptionsCenter,
			end: ensureEndToolbar(),
		},
		customButtons: makeCustomButtons(),
		events: eventsList,
		eventDisplay: isAggregate() ? 'none' : 'auto',
		dayCellContent: isAggregate() ? dayCellContentAgg : undefined,
		dayCellDidMount: isAggregate() ? dayCellDidMountAgg : undefined,
		eventClick: isAggregate() ? undefined : onEventClick,
	};

	const { styleable } = getContext('sdk');
	const component = getContext('component');
</script>

<div use:styleable={$component.styles}>
	<FullCalendar {options} />
</div>

<style>
	.bbfc-wrap {
		position: relative;
		height: 100%;
		width: 100%;
	}
	.bbfc-daynum {
		position: absolute;
		top: 0.35rem;
		left: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		color: #1a1a1a;
		opacity: 0.9;
		pointer-events: none;
	}
	.bbfc-center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: none;
	}
	.bbfc-label {
		font-size: 1.05rem;
		font-weight: 700;
		line-height: 1.15;
		color: #0f172a;
		text-align: center;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
		padding: 0 0.35rem;
	}
	.bbfc-today {
		outline: 3px solid rgba(0, 0, 0, 0.35);
		outline-offset: -2px;
	}
</style>
