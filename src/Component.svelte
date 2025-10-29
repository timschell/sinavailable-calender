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

	// Umschaltmodus: "counts" (nur Anzahl je Tag) oder "events" (Einzel-Events)
	export let viewMode = 'counts';

	// ===== Interne States =====
	let eventsList = [];
	let eventsByDate = {};
	let countsByDate = {};

	// Hilfsfunktionen
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
					event: row, // Original-Row in extendedProps
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

	// Reaktiv neu aufbauen, wenn Daten oder Mappings wechseln
	$: JSON.stringify({
		a: dataProvider?.rows,
		b: dataProvider2?.rows,
		m1: {
			mappingTitle,
			mappingDate,
			mappingStart,
			mappingEnd,
			allday,
			mappingColor,
		},
		m2: {
			mappingTitle2,
			mappingDate2,
			mappingStart2,
			mappingEnd2,
			allday2,
			mappingColor2,
		},
	}),
		buildEvents();

	// ===== FullCalendar-Optionen (dynamisch) =====
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

	const dayCellContentAgg = (arg) => {
		const key = arg.date.toISOString().slice(0, 10);
		const count = countsByDate[key] || 0;
		const num = arg.dayNumberText;
		return {
			html: `
        <div class="bbfc-day">
          <span class="bbfc-day-number">${num}</span>
          ${count > 0 ? `<span class="bbfc-badge" title="${count} Ereignis${count > 1 ? 'se' : ''}">${count}</span>` : ''}
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
		const dateStr = info.dateStr; // YYYY-MM-DD
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

		// Umschaltbare Teile:
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
	.bbfc-day {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding-right: 0.25rem;
	}
	.bbfc-day-number {
		font-weight: 600;
	}
	.bbfc-badge {
		display: inline-block;
		min-width: 1.25rem;
		padding: 0 0.375rem;
		border-radius: 9999px;
		font-size: 0.75rem;
		line-height: 1.25rem;
		text-align: center;
		background: rgba(25, 118, 210, 0.15);
		border: 1px solid rgba(25, 118, 210, 0.35);
		user-select: none;
	}
</style>
