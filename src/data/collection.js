// Futile Recording Co — physical media collection.
//
// Add an entry per vinyl / cassette you own. `audioSrc` should point at the
// FLAC file hosted on your own server (e.g. https://media.futile.studio/...).
// Leave it empty ('') to show the item on the shelf without a working player yet.
//
// `cover` is optional — drop an image in public/collection/ and reference it
// as '/collection/your-file.jpg'. Without one, a plain schematic label is drawn.

export const collection = [
	{
		id: 'album-one',
		format: 'vinyl', // 'vinyl' | 'cassette'
		title: 'Album One',
		artist: 'Artist Name',
		year: 1983,
		cover: '',
		audioSrc: '',
	},
	{
		id: 'album-two',
		format: 'cassette',
		title: 'Album Two',
		artist: 'Artist Name',
		year: 1991,
		cover: '',
		audioSrc: '',
	},
	{
		id: 'album-three',
		format: 'vinyl',
		title: 'Album Three',
		artist: 'Artist Name',
		year: 2001,
		cover: '',
		audioSrc: '',
	},
	{
		id: 'my-recording',
		format: 'vinyl',
		title: 'My Recording',
		artist: 'Futile Recording Co',
		year: 2025,
		cover: '',
		audioSrc: '',
	},
];
