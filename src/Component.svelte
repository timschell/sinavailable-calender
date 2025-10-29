<script>
	import { getContext } from 'svelte';
	import '@fullcalendar/core/locales-all';
	import FullCalendar from 'svelte-fullcalendar';
	import daygridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import listPlugin from '@fullcalendar/list';
	import { onMount } from 'svelte';
	import { langs, codeLang } from './lang';

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
	export let viewMode = 'counts';

	// Neue Threshold-Einstellungen
	export let thresholdGreen = 1;
	export let thresholdYellow = 3;
	export let thresholdRed = 4;

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
				const eventColor = mappingColor ?? '#313131';
				const ev = {
					title: row?.[mappingTitle],
					date: row?.[mappingDate],
					start: row?.[mappingStart],
					end: row?.[mappingEnd],
					color: eventColor,
					event: row,
					allDay: allday,
				};
				eventsList.push(ev);
				addEventToBuckets(ev);
			});
		}

		if (dataProvider2?.rows) {
			dataProvider2.rows.forEach((row) => {
				const eventColor2 = mappingColor2 ?? '#eb4034';
				const ev = {
					title: row?.[mappingTitle2],
					date: row?.[mappingDate2],
					start: row?.[mappingStart2],
					end: row?.[mappingEnd2],
					color: eventColor2,
					event: row,
					allDay: allday2,
				};
				eventsList.push(ev);
				addEventToBuckets(ev);
			});
		}
	};

	onMount(buildEvents);
	$: JSON.stringify({
		a: dataProvider?.rows,
		b: dataProvider2?.rows,
	}),
		buildEvents();

	const isAggregate = () => viewMode === 'counts';

	const baseOptions = {
		plugins: [daygridPlugin, listPlugin, timeGridPlugin],
		initialDate: Date.now(),
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

	// Farblogik pro Tag
	const getColorForCount = (count) => {
		if (count >= thresholdRed) return 'var(--bbfc-red)';
		if (count >= thresholdYellow) return 'var(--bbfc-yellow)';
		return 'var(--bbfc-green)';
	};

	// Darstellung pro Zelle
	const dayCellContentAgg = (arg) => {
		const key = arg.date.toISOString().slice(0, 10);
		const count = countsByDate[key] || 0;
		const bg = getColorForCount(count);
		return {
			html: `
        <div class="bbfc-day" style="background:${bg}">
          <span class="bbfc-count">${count > 0 ? count : ''}</span>
        </div>
      `,
		};
	};

	const onEventClick = (event) => {
		const rowId = event?.event?.extendedProps?.event?._id || '';
		calendarEvent({
			value: event.event,
			rowId,
		});
	};

	const onDateClick = (info) => {
		const dateStr = info.dateStr;
		const events = eventsByDate[dateStr] || [];
		calendarEvent({
			value: { date: dateStr, count: events.length, events },
		});
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
	:root {
		--bbfc-green: rgba(76, 175, 80, 0.25);
		--bbfc-yellow: rgba(255, 235, 59, 0.35);
		--bbfc-red: rgba(244, 67, 54, 0.35);
	}

	.bbfc-day {
		position: relative;
		height: 100%;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: background 0.2s ease-in-out;
	}

	.bbfc-count {
		font-size: 1.5rem;
		font-weight: 700;
		color: #1a1a1a;
	}
</style>
