<script>
	import { getContext } from 'svelte';
	import '@fullcalendar/core/locales-all';
	import FullCalendar from 'svelte-fullcalendar';
	import daygridPlugin from '@fullcalendar/daygrid';
	import timeGridPlugin from '@fullcalendar/timegrid';
	import listPlugin from '@fullcalendar/list';
	import { onMount } from 'svelte';
	import { langs, codeLang } from './lang';

	// Budibase injiziert diese Props
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

	let eventsList = [];

	function buildEvents() {
		eventsList = [];

		if (dataProvider?.rows?.length) {
			for (const row of dataProvider.rows) {
				eventsList.push({
					title: row?.[mappingTitle],
					date: row?.[mappingDate],
					start: row?.[mappingStart],
					end: row?.[mappingEnd],
					color: mappingColor ?? '#313131',
					allDay: !!allday,
					// Eigener Row hängt unter extendedProps.event
					event: row,
				});
			}
		}

		if (dataProvider2?.rows?.length) {
			for (const row of dataProvider2.rows) {
				eventsList.push({
					title: row?.[mappingTitle2],
					date: row?.[mappingDate2],
					start: row?.[mappingStart2],
					end: row?.[mappingEnd2],
					color: mappingColor2 ?? '#000000',
					allDay: !!allday2,
					event: row,
				});
			}
		}
	}

	onMount(buildEvents);
	// Reaktiv neu bauen, wenn Inputs wechseln
	$: buildEvents();

	const options = {
		headerToolbar: {
			start: headerOptionsStart,
			center: headerOptionsCenter,
			end: headerOptionsEnd,
		},
		plugins: [daygridPlugin, listPlugin, timeGridPlugin],
		initialDate: new Date(),
		locale: language,
		dayMaxEvents: true,
		events: eventsList,
		eventColor: '#378006',
		theme: true,
		...langs[codeLang(language)],

		// >>> Entscheidend: beim Klick Row- und Table-ID mitgeben
		eventClick: (info) => {
			const fcEvent = info?.event;
			const row = fcEvent?.extendedProps?.event || {};
			const rowId = row?._id || '';
			const tableId = row?.tableId || '';

			// value als String – wie bisher – damit nichts bricht
			calendarEvent({
				value: JSON.stringify({
					allDay: fcEvent?.allDay,
					title: fcEvent?.title,
					start: fcEvent?.start,
					end: fcEvent?.end,
					backgroundColor: fcEvent?.backgroundColor,
					borderColor: fcEvent?.borderColor,
					extendedProps: fcEvent?.extendedProps,
				}),
				rowId,
				tableId,
			});
		},
	};

	const { styleable } = getContext('sdk');
	const component = getContext('component');
</script>

<div use:styleable={$component.styles}>
	<FullCalendar {options} />
</div>
