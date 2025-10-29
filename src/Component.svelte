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

	// Umschalten zwischen "counts" und "events"
	export let viewMode = 'counts';

	// Schwellen & Farben aus der Sidebar
	export let thresholdGreen = 1;
	export let thresholdYellow = 3;
	export let thresholdRed = 4;

	export let colorGreen = 'rgba(76,175,80,0.25)';
	export let colorYellow = 'rgba(255,235,59,0.35)';
	export let colorRed = 'rgba(244,67,54,0.35)';

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
	// Rebuild, wenn Daten/Mappings/Farben/Schwellen wechseln
	$: JSON.stringify({
		a: dataProvider?.rows,
		b: dataProvider2?.rows,
		t: { thresholdGreen, thresholdYellow, thresholdRed },
		c: { colorGreen, colorYellow, colorRed },
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
			click: () => (viewMode = isAggregate() ? 'events' : 'counts'),
		},
	});

	const ensureEndToolbar = () => {
		const end = (headerOptionsEnd ?? '').trim();
		return end.length > 0
			? `${end},toggleView`
			: 'dayGridMonth,dayGridWeek,timeGridDay,toggleView';
	};

	// Farbe nach Count bestimmen
	const colorForCount = (count) => {
		if (count >= thresholdRed) return colorRed;
		if (count >= thresholdYellow) return colorYellow;
		if (count > 0) return colorGreen;
		return ''; // 0 = keine Füllfarbe
	};

	// Ganze Zelle färben + Inhalt mit Tag + großer Count
	const dayCellDidMountAgg = (arg) => {
		const key = arg.date.toISOString().slice(0, 10);
		const count = countsByDate[key] || 0;
		const bg = colorForCount(count);

		// komplette td einfärben (inline style gewinnt gegen Default)
		if (bg) {
			arg.el.style.background = bg;
			arg.el.style.borderRadius = '6px';
		} else {
			arg.el.style.background = '';
		}

		// Titel (Tooltip) mit Count
		arg.el.title = count > 0 ? `${count} Ereignis${count > 1 ? 'se' : ''}` : '';

		// Klasse setzen (falls du global stylen willst)
		arg.el.classList.toggle('bbfc-colored', !!bg);
	};

	// Inhalt der Zelle: Tag oben links + Count mittig groß
	const dayCellContentAgg = (arg) => {
		const key = arg.date.toISOString().slice(0, 10);
		const count = countsByDate[key] || 0;
		const dayNum = arg.dayNumberText; // z.B. "28"
		return {
			html: `
        <div class="bbfc-wrap">
          <div class="bbfc-daynum">${dayNum}</div>
          <div class="bbfc-center">
            ${count > 0 ? `<span class="bbfc-count">${count}</span>` : ''}
          </div>
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
		calendarEvent({ value: { date: dateStr, count: events.length, events } });
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

		// Umschaltbar:
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
	/* Wrapper füllt die Zelle */
	.bbfc-wrap {
		position: relative;
		height: 100%;
		width: 100%;
	}

	/* Tageszahl oben links wie gewohnt */
	.bbfc-daynum {
		position: absolute;
		top: 0.35rem;
		left: 0.5rem;
		font-weight: 600;
		font-size: 0.9rem;
		color: #1a1a1a;
		opacity: 0.9;
	}

	/* Count mittig und groß */
	.bbfc-center {
		position: absolute;
		inset: 0;
		display: flex;
		align-items: center;
		justify-content: center;
	}
	.bbfc-count {
		font-size: 1.6rem;
		font-weight: 800;
		line-height: 1;
		color: #0f172a; /* fast-schwarz, bleibt auf allen BGs lesbar */
		text-shadow: 0 1px 0 rgba(255, 255, 255, 0.25);
	}

	/* Optional Hover-Effekt für farbige Felder */
	.bbfc-colored:hover {
		filter: brightness(0.96);
	}
</style>
