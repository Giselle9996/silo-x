(function () {
	'use strict';

	// Mobile nav toggle
	var toggle = document.getElementById( 'nav-toggle' );
	var nav = document.getElementById( 'primary-nav' );
	if ( toggle && nav ) {
		toggle.addEventListener( 'click', function () {
			var isOpen = nav.classList.toggle( 'is-open' );
			toggle.setAttribute( 'aria-expanded', isOpen ? 'true' : 'false' );
		} );
	}

	// Mark current nav item
	var here = window.location.pathname.replace( /\/$/, '' ).replace(/\/index\.html$/, '') || '/';
	document.querySelectorAll( '.primary-nav a' ).forEach( function ( a ) {
		var path = a.getAttribute( 'href' ) || '';
		try {
			var url = new URL( path, window.location.origin ).pathname.replace( /\/$/, '' ).replace(/\/index\.html$/, '') || '/';
			if ( url === here ) a.setAttribute( 'aria-current', 'page' );
		} catch ( e ) {}
	} );

	// Scroll reveal
	var reduceMotion = window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches;
	var revealEls = document.querySelectorAll( '[data-reveal]' );
	if ( 'IntersectionObserver' in window && !reduceMotion && revealEls.length ) {
		var io = new IntersectionObserver( function ( entries ) {
			entries.forEach( function ( entry ) {
				if ( entry.isIntersecting ) {
					entry.target.classList.add( 'is-visible' );
					io.unobserve( entry.target );
				}
			} );
		}, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' } );
		revealEls.forEach( function ( el ) { io.observe( el ); } );
	} else {
		revealEls.forEach( function ( el ) { el.classList.add( 'is-visible' ); } );
	}

	// Time savings visualizer: trigger bar fill when scrolled into view
	var timeViz = document.querySelector( '.time-viz' );
	if ( timeViz && 'IntersectionObserver' in window ) {
		var tvIo = new IntersectionObserver( function ( entries ) {
			entries.forEach( function ( entry ) {
				if ( entry.isIntersecting ) {
					entry.target.classList.add( 'is-active' );
					tvIo.unobserve( entry.target );
				}
			} );
		}, { threshold: 0.4 } );
		tvIo.observe( timeViz );
	} else if ( timeViz ) {
		timeViz.classList.add( 'is-active' );
	}

	// FAQ accordion
	document.querySelectorAll( '.faq-item__q' ).forEach( function ( btn ) {
		btn.addEventListener( 'click', function () {
			var item = btn.closest( '.faq-item' );
			var answer = item.querySelector( '.faq-item__a' );
			var isOpen = item.classList.contains( 'is-open' );
			// Close siblings in the same group for a tidier list
			var group = item.closest( '.faq-group' );
			if ( group ) {
				group.querySelectorAll( '.faq-item.is-open' ).forEach( function ( other ) {
					if ( other !== item ) {
						other.classList.remove( 'is-open' );
						other.querySelector( '.faq-item__q' ).setAttribute( 'aria-expanded', 'false' );
						other.querySelector( '.faq-item__a' ).style.maxHeight = null;
					}
				} );
			}
			if ( isOpen ) {
				item.classList.remove( 'is-open' );
				btn.setAttribute( 'aria-expanded', 'false' );
				answer.style.maxHeight = null;
			} else {
				item.classList.add( 'is-open' );
				btn.setAttribute( 'aria-expanded', 'true' );
				answer.style.maxHeight = answer.scrollHeight + 'px';
			}
		} );
	} );

	// Contact form: conditional sections based on path chosen
	var pathRadios = document.querySelectorAll( 'input[name="inquiry-path"]' );
	if ( pathRadios.length ) {
		var blocks = {
			website: document.querySelector( '[data-conditional="website"]' ),
			operations: document.querySelector( '[data-conditional="operations"]' ),
			both: null,
			other: null
		};
		var updateBlocks = function ( value ) {
			Object.keys( blocks ).forEach( function ( key ) {
				if ( !blocks[ key ] ) return;
				var show = ( value === key ) || ( value === 'both' && ( key === 'website' || key === 'operations' ) );
				blocks[ key ].classList.toggle( 'is-visible', show );
			} );
		};
		pathRadios.forEach( function ( radio ) {
			radio.addEventListener( 'change', function () { updateBlocks( radio.value ); } );
			if ( radio.checked ) updateBlocks( radio.value );
		} );
	}

	// Subtle parallax tilt on hero illustrations, desktop hover only
	var canHover = window.matchMedia( '(hover: hover) and (pointer: fine)' ).matches;
	if ( canHover && !reduceMotion ) {
		document.querySelectorAll( '.hero-stage img' ).forEach( function ( img ) {
			var stage = img.closest( '.hero-stage' );
			stage.addEventListener( 'mousemove', function ( e ) {
				var rect = stage.getBoundingClientRect();
				var px = ( e.clientX - rect.left ) / rect.width - 0.5;
				var py = ( e.clientY - rect.top ) / rect.height - 0.5;
				img.style.transform = 'rotate(' + ( px * 4 ) + 'deg) translate(' + ( px * 10 ) + 'px,' + ( py * 10 ) + 'px)';
			} );
			stage.addEventListener( 'mouseleave', function () {
				img.style.transform = '';
			} );
		} );
	}

	// 3D tilt + glare on cards marked [data-tilt], desktop hover only
	if ( canHover && !reduceMotion ) {
		var MAX_TILT = 9; // degrees
		document.querySelectorAll( '[data-tilt]' ).forEach( function ( card ) {
			card.addEventListener( 'mouseenter', function () {
				card.classList.add( 'is-tilting' );
			} );
			card.addEventListener( 'mousemove', function ( e ) {
				var rect = card.getBoundingClientRect();
				var px = ( e.clientX - rect.left ) / rect.width;
				var py = ( e.clientY - rect.top ) / rect.height;
				var ry = ( px - 0.5 ) * MAX_TILT * 2;
				var rx = ( 0.5 - py ) * MAX_TILT * 2;
				card.style.setProperty( '--rx', rx.toFixed(2) + 'deg' );
				card.style.setProperty( '--ry', ry.toFixed(2) + 'deg' );
				card.style.setProperty( '--mx', ( px * 100 ).toFixed(1) + '%' );
				card.style.setProperty( '--my', ( py * 100 ).toFixed(1) + '%' );
			} );
			card.addEventListener( 'mouseleave', function () {
				card.classList.remove( 'is-tilting' );
				card.style.setProperty( '--rx', '0deg' );
				card.style.setProperty( '--ry', '0deg' );
			} );
		} );
	}

	// Simple client-side validation helper used by checkout + contact forms
	window.siloxValidate = function ( form ) {
		var valid = true;
		form.querySelectorAll( '[required]' ).forEach( function ( field ) {
			var wrap = field.closest( '.form-field' ) || field.parentElement;
			var isEmpty = !field.value || !field.value.trim();
			var isBadEmail = field.type === 'email' && field.value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test( field.value );
			if ( isEmpty || isBadEmail ) {
				valid = false;
				if ( wrap ) wrap.classList.add( 'has-error' );
			} else if ( wrap ) {
				wrap.classList.remove( 'has-error' );
			}
		} );
		return valid;
	};
})();
