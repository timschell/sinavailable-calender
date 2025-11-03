<script>
	import { getContext } from 'svelte';
	import '@fullcalendar/core/locales-all';
	import FullCalendar from 'svelte-fullcalendar';
	import daygridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import listPlugin from '@fullcalendar/list';
	import interactionPlugin from '@fullcalendar/interaction'; // ← NEU, wichtig!
	import { onMount } from 'svelte';
	import { langs, codeLang } from './lang';

	// --- Budibase Inputs ---
	export let language;
	export let calendarEvent;

	export let mappingTitle;
	export let mappingDate;
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

	// Ansicht: "counts" (aggregiert) oder "events" (Einzeltermine)
	export let viewMode = 'counts';

	// --- Farb-/Schwellen-Logik (Sidebar) ---
	export let thresholdMin = 1;
	export let thresholdMax = 5;

	export let colorMin = 'rgba(76,175,80,0.25)';
	export let colorNeutral = 'rgba(255,235,59,0.35)';
	export let colorMax = 'rgba(244,67,54,0.35)';

	// Anzeige-Template im Aggregatmodus (Sidebar)
	export let displayTemplate = '{count}';

	// --- Interner State ---
	let eventsList = [];
	let eventsByDate = {};
	let countsByDate = {};

	const toISODate = (val) => {
		if (!val) return null;
		const d = new Date(val);
		if (isNaN(d)) return null;
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

		if (dataProvider?.rows) {
			dataProvider.rows.forEach((row) => {
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

	// Rebuild bei Daten-/Konfig-Änderungen
	$: JSON.stringify({
		a: dataProvider?.rows,
		b: dataProvider2?.rows,
		th: { thresholdMin, thresholdMax },
		col: { colorMin, colorNeutral, colorMax },
		dt: displayTemplate,
	}),
		buildEvents();

	const isAggregate = () => viewMode === 'counts';

	const baseOptions = {
		plugins: [daygridPlugin, listPlugin, timeGridPlugin, interactionPlugin], // ← interaction hinzugefügt!
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

	const sameDay = (d1, d2) =>
		d1.getFullYear() === d2.getFullYear() &&
		d1.getMonth() === d2.getMonth() &&
		d1.getDate() === d2.getDate();

	const formatDisplay = (dateObj, count) => {
		const iso = dateObj.toISOString().slice(0, 10);
		const weekday = dateObj.toLocaleDateString(language || 'de', {
			weekday: 'short',
		});
		const dateHuman = dateObj.toLocaleDateString(language || 'de', {
			day: '2-digit',
			month: '2-digit',
			year: 'numeric',
		});
		return (displayTemplate || '{count}')
			.replaceAll('{count}', String(count))
			.replaceAll('{iso}', iso)
			.replaceAll('{weekday}', weekday)
			.replaceAll('{date}', dateHuman);
	};

	// gesamte Zelle einfärben + Today hervorheben + Klickbarkeit
	const dayCellDidMountAgg = (arg) => {
		const key = arg.date.toISOString().slice(0, 10);
		const count = countsByDate[key] || 0;
		const bg = colorForCount(count);

		// Hintergrundfarbe
		if (bg) {
			arg.el.style.background = bg;
			arg.el.style.borderRadius = '6px';
		} else {
			arg.el.style.background = '';
		}

		// Heute hervorheben
		const isToday = sameDay(arg.date, new Date());
		if (isToday) {
			arg.el.classList.add('bbfc-today');
		} else {
			arg.el.classList.remove('bbfc-today');
		}

		// Klickbarkeit aktivieren
		arg.el.style.cursor = 'pointer';
		arg.el.setAttribute('role', 'button');
		arg.el.title = count > 0 ? `${count} Ereignis${count > 1 ? 'se' : ''}` : '';
	};

	// Inhalt der Zelle (Tageszahl oben links, Text mittig)
	const dayCellContentAgg = (arg) => {
		const key = arg.date.toISOString().slice(0, 10);
		const count = countsByDate[key] || 0;
		const dayNum = arg.dayNumberText || '';
		const label = count > 0 ? formatDisplay(arg.date, count) : '';
		return {
			html: `
        <div class="bbfc-wrap">
          <div class="bbfc-daynum">${dayNum}</div>
          <div class="bbfc-center">
            ${label ? `<span class="bbfc-label">${label}</span>` : ''}
          </div>
        </div>
      `,
		};
	};

	// Events-Ansicht: Klick auf Event
	const onEventClick = (event) => {
		const rowId = event?.event?.extendedProps?.event?._id || '';
		calendarEvent({ value: event.event, rowId });
	};

	// Counts-Ansicht: Klick auf Tag -> feuert Budibase-Action
	const onDateClick = (info) => {
		const dateStr = info.dateStr;
		const events = eventsByDate[dateStr] || [];
		const count = events.length;
		const payload = {
			date: dateStr,
			count,
			events,
			label: formatDisplay(new Date(dateStr), count),
			isToday: sameDay(new Date(dateStr), new Date()),
		};
		calendarEvent({ value: payload }); // → Budibase "On Click"-Aktionen
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

		// Umschaltbarer Modus
		eventDisplay: isAggregate() ? 'none' : 'auto',
		dayCellContent: isAggregate() ? dayCellContentAgg : undefined,
		dayCellDidMount: isAggregate() ? dayCellDidMountAgg : undefined,
		dateClick: isAggregate() ? onDateClick : undefined,
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
		font-size: 1.1rem;
		font-weight: 800;
		line-height: 1;
		color: #0f172a;
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
	}

	.bbfc-today {
		outline: 3px solid rgba(0, 0, 0, 0.35);
		outline-offset: -2px;
		filter: saturate(1.05) brightness(0.98);
	}

	.bbfc-colored:hover {
		filter: brightness(0.96);
	}
</style>
