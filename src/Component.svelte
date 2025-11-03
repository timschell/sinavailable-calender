<script>
	import { getContext } from 'svelte';
	import '@fullcalendar/core/locales-all';
	import FullCalendar from 'svelte-fullcalendar';
	import dayGridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import listPlugin from '@fullcalendar/list';
	import interactionPlugin from '@fullcalendar/interaction';
	import { onMount } from 'svelte';
	import { langs, codeLang } from './lang';

	// === Budibase Inputs ===
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

	export let viewMode = 'counts'; // „counts“ oder „events“

	// === Farb- & Schwellenlogik (Sidebar) ===
	export let thresholdMin = 1;
	export let thresholdMax = 5;
	export let colorMin = 'rgba(76,175,80,0.25)';
	export let colorNeutral = 'rgba(255,235,59,0.35)';
	export let colorMax = 'rgba(244,67,54,0.35)';
	export let displayTemplate = '{count}';

	// === State ===
	let eventsList = [];
	let eventsByDate = {};
	let countsByDate = {};

	// === Hilfsfunktionen ===
	const toISO = (val) => {
		const d = new Date(val);
		if (isNaN(d)) return null;
		return d.toISOString().slice(0, 10);
	};

	const sameDay = (a, b) =>
		a.getFullYear() === b.getFullYear() &&
		a.getMonth() === b.getMonth() &&
		a.getDate() === b.getDate();

	const addEvent = (ev) => {
		const key = toISO(ev.start || ev.date);
		if (!key) return;
		if (!eventsByDate[key]) eventsByDate[key] = [];
		eventsByDate[key].push(ev);
		countsByDate[key] = (countsByDate[key] || 0) + 1;
	};

	const buildEvents = () => {
		eventsList = [];
		eventsByDate = {};
		countsByDate = {};

		const pushFromProvider = (rows, title, date, start, end, color, allDay) => {
			rows?.forEach((r) => {
				const ev = {
					title: r?.[title],
					date: r?.[date],
					start: r?.[start],
					end: r?.[end],
					color,
					event: r,
					allDay,
				};
				eventsList.push(ev);
				addEvent(ev);
			});
		};

		pushFromProvider(
			dataProvider?.rows,
			mappingTitle,
			mappingDate,
			mappingStart,
			mappingEnd,
			mappingColor ?? '#313131',
			allday
		);
		pushFromProvider(
			dataProvider2?.rows,
			mappingTitle2,
			mappingDate2,
			mappingStart2,
			mappingEnd2,
			mappingColor2 ?? '#eb4034',
			allday2
		);
	};

	onMount(buildEvents);
	$: JSON.stringify({
		dp1: dataProvider?.rows,
		dp2: dataProvider2?.rows,
		th: { thresholdMin, thresholdMax },
		col: { colorMin, colorNeutral, colorMax },
		tpl: displayTemplate,
	}),
		buildEvents();

	// === Farb- & Anzeige-Logik ===
	const colorForCount = (count) => {
		if (count >= thresholdMax) return colorMax;
		if (count <= thresholdMin) return colorMin;
		return colorNeutral;
	};

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
			.replaceAll('{count}', count)
			.replaceAll('{iso}', iso)
			.replaceAll('{weekday}', weekday)
			.replaceAll('{date}', dateHuman);
	};

	// === FullCalendar Optionen ===
	const isCounts = () => viewMode === 'counts';

	const makeButtons = () => ({
		toggleView: {
			text: isCounts() ? 'Events' : 'Anzahl',
			click: () => (viewMode = isCounts() ? 'events' : 'counts'),
		},
	});

	const ensureToolbar = () => {
		const e = (headerOptionsEnd ?? '').trim();
		return e ? `${e},toggleView` : 'dayGridMonth,toggleView';
	};

	const dayCellDidMountAgg = (arg) => {
		const key = toISO(arg.date);
		const count = countsByDate[key] || 0;
		const bg = colorForCount(count);
		arg.el.style.background = bg || '';
		arg.el.style.borderRadius = '6px';

		// Heute hervorheben
		if (sameDay(arg.date, new Date())) {
			arg.el.classList.add('bbfc-today');
		}

		arg.el.style.cursor = 'pointer';
		arg.el.title = `${count} Ereignis${count !== 1 ? 'se' : ''}`;
	};

	const dayCellContentAgg = (arg) => {
		const key = toISO(arg.date);
		const count = countsByDate[key] || 0;
		const dayNum = arg.dayNumberText;
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

	const onEventClick = (event) => {
		const rowId = event?.event?.extendedProps?.event?._id || '';
		calendarEvent({ value: event.event, rowId });
	};

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
		// >>> Das feuert deine Budibase On Click Aktionen <<<
		calendarEvent({ value: payload });
	};

	let options;
	$: options = {
		plugins: [dayGridPlugin, listPlugin, timeGridPlugin, interactionPlugin],
		headerToolbar: {
			start: headerOptionsStart,
			center: headerOptionsCenter,
			end: ensureToolbar(),
		},
		customButtons: makeButtons(),
		initialView: 'dayGridMonth',
		initialDate: Date.now(),
		locale: language,
		dayMaxEvents: true,
		firstDay: 1,
		theme: true,
		events: eventsList,

		// Umschaltlogik
		eventDisplay: isCounts() ? 'none' : 'auto',
		dayCellContent: isCounts() ? dayCellContentAgg : undefined,
		dayCellDidMount: isCounts() ? dayCellDidMountAgg : undefined,
		dateClick: isCounts() ? onDateClick : undefined,
		eventClick: isCounts() ? undefined : onEventClick,
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
		outline: 3px solid rgba(0, 0, 0, 0.4);
		outline-offset: -2px;
		filter: brightness(0.97);
	}

	.fc-daygrid-day:hover {
		filter: brightness(0.95);
	}
</style>
