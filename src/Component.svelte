<script>
	import { getContext } from 'svelte';
	import '@fullcalendar/core/locales-all';
	import FullCalendar from 'svelte-fullcalendar';
	import daygridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import listPlugin from '@fullcalendar/list';
	import { onMount } from 'svelte';
	import { langs, codeLang } from './lang';

	// Budibase Inputs
	export let language;
	export let calendarEvent;

	export let mappingTitle;
	export let mappingDate; // z.B. "date" = "5.11.2025"
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

	// Ansicht: counts / events
	export let viewMode = 'counts';

	// Schwellen & Farben (Hinweis: Max greift bei >= thresholdMax)
	export let thresholdMin = 1;
	export let thresholdMax = 6;

	// Wenn du „viel = grün“ willst, setz colorMax grün:
	export let colorMin = 'rgba(244,67,54,0.35)'; // wenig/<=Min -> rot
	export let colorNeutral = 'rgba(255,235,59,0.35)'; // dazwischen -> gelb
	export let colorMax = 'rgba(76,175,80,0.35)'; // viel/>=Max -> grün

	// Anzeige-Text
	export let displayTemplate = ''; // optional override
	export let displayTemplateSingular = 'Es ist {count} SINA-Gerät verfügbar';
	export let displayTemplatePlural = 'Es sind {count} SINA-Geräte verfügbar';

	// Optionaler Filter: nur Zeilen zählen, wenn Feld == Wert (z. B. status == "frei")
	export let filterField = 'status';
	export let filterEquals = 'frei';

	// State
	let eventsList = [];
	let eventsByDate = {};
	let countsByDate = {};

	// ---- robustes Datums-Parsing ----
	const parseToDate = (val) => {
		if (!val) return null;

		if (val instanceof Date) {
			return isNaN(val) ? null : val;
		}

		if (typeof val === 'number') {
			const d = new Date(val);
			return isNaN(d) ? null : d;
		}

		if (typeof val === 'string') {
			const s = val.trim();

			// DD.MM.YYYY
			const m1 = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
			if (m1) {
				const dd = parseInt(m1[1], 10);
				const mm = parseInt(m1[2], 10);
				const yyyy = parseInt(m1[3], 10);
				const d = new Date(yyyy, mm - 1, dd);
				return isNaN(d) ? null : d;
			}

			// YYYY-MM-DD
			const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
			if (m2) {
				const yyyy = parseInt(m2[1], 10);
				const mm = parseInt(m2[2], 10);
				const dd = parseInt(m2[3], 10);
				const d = new Date(yyyy, mm - 1, dd);
				return isNaN(d) ? null : d;
			}

			// Fallback: native Parser
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

	const includeRow = (row) => {
		if (!filterField || filterEquals === undefined || filterEquals === null)
			return true;
		return row?.[filterField] === filterEquals;
	};

	const buildEvents = () => {
		eventsList = [];
		eventsByDate = {};
		countsByDate = {};

		if (dataProvider?.rows) {
			dataProvider.rows.forEach((row) => {
				if (!includeRow(row)) return;
				const ev = {
					title: row?.[mappingTitle],
					date: row?.[mappingDate],
					start: row?.[mappingStart],
					end: row?.[mappingEnd],
					color: mappingColor ?? '#313131',
					event: row,
					allDay: allday,
				};
				eventsList.push(ev);
				addEventToBuckets(ev);
			});
		}

		if (dataProvider2?.rows) {
			dataProvider2.rows.forEach((row) => {
				if (!includeRow(row)) return;
				const ev = {
					title: row?.[mappingTitle2],
					date: row?.[mappingDate2],
					start: row?.[mappingStart2],
					end: row?.[mappingEnd2],
					color: mappingColor2 ?? '#eb4034',
					event: row,
					allDay: allday2,
				};
				eventsList.push(ev);
				addEventToBuckets(ev);
			});
		}
	};

	onMount(buildEvents);

	// Rebuild bei Änderungen
	$: JSON.stringify({
		a: dataProvider?.rows,
		b: dataProvider2?.rows,
		maps: {
			mappingTitle,
			mappingDate,
			mappingStart,
			mappingEnd,
			mappingTitle2,
			mappingDate2,
			mappingStart2,
			mappingEnd2,
		},
		dayFilter: { filterField, filterEquals },
		th: { thresholdMin, thresholdMax },
		col: { colorMin, colorNeutral, colorMax },
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
			displayTemplate && displayTemplate.trim().length > 0
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
		const key = `${arg.date.getFullYear()}-${String(arg.date.getMonth() + 1).padStart(2, '0')}-${String(arg.date.getDate()).padStart(2, '0')}`;
		const count = countsByDate[key] || 0;
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
			const events = eventsByDate[key] || [];
			const payload = {
				date: key,
				count: events.length,
				events,
				label: formatDisplay(new Date(key), events.length),
				isToday: isTodayLocal(new Date(key)),
			};
			calendarEvent({ value: payload, clickedDate: key });
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
