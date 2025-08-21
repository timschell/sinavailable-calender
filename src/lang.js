export const langs = [
	{
		code: 'de',
		week: {
			dow: 1,
			doy: 4,
		},
		buttonText: {
			prev: 'Zurück',
			next: 'Weiter',
			today: 'Heute',
			year: 'Jahr',
			month: 'Monat',
			week: 'Woche',
			day: 'Tag',
			list: 'Terminübersicht',
		},
		weekText: 'Woche',
		allDayText: 'Ganzer Tag',
		moreLinkText: 'mehr',
		noEventsText: 'Keine Ereignisse anzuzeigen',
	},
	{
		code: 'en',
		week: {
			dow: 1,
			doy: 4,
		},
		buttonText: {
			prev: 'Prev',
			next: 'Next',
			today: 'Today',
			year: 'Year',
			month: 'Month',
			week: 'Week',
			day: 'Day',
			list: 'Agenda',
		},
		weekText: 'Wk',
		allDayText: 'All day',
		moreLinkText: 'more',
		noEventsText: 'No events to display',
	},
];

export function codeLang(lang) {
	const code = langs.findIndex((item) => item.code === lang);

	if (code === -1) {
		console.warn(`Unknown language code: ${lang}`);
		return null;
	}

	console.log(code, 'code', lang);
	return code;
}
