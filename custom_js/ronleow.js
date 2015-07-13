/*
* Game.Scene.Lake: controls animations for gas gauge, sharks, and other moving things.
* To keep things simple, we treat the characters as set pieces that get moved about.
*/

Game.Scene.new(Game.Scene.Basic, "Lake", 
{
	finalize: function (round) {
		// keep references to my set pieces.
		this.swimmer = $("#swimmer");
		this.boatContainer = $("#boat-container");
		this.boat = $("#boat");
		this.blackBackdrop = $("#blackBackdrop");
		this.needle = $("svg path#needle");
		this.gas_tank = $("#gas_tank");
		this.last_regular_round_nbr = 20;
		
		// add a cheat key.
		var _this = this;
		$(document).keypress(function (evt) {
			switch (evt.charCode) {
				case 35: // # sign.
					// jump to round 18 (17th index).
					round.abort(round.game.rounds[17], Game.clearCards);
					round.game.round_nbr = round.nbr = 18;
					round.game.setPoints(17);
					_this.addGas(17).then(function () {
						_this.gas_tank.hide();
					});
			}
		})
	},
	
	leaveEvaluateResponse: function (evt, info) {
		var game = this.game;
		var round = info.round;
		var responder = round.responder;
		var answer = responder.answer;
		var score = responder.score;
		var current_score = game.current_score || 0;
		

		// bind animation functions to this object (may be used in callbacks).
		var playerDrivesBoat = this.playerDrivesBoat.bind(this);
		var boatSinks = this.boatSinks.bind(this);
		var playerSwimsBack = this.playerSwimsBack.bind(this);
		var celebrateAtFarShore = this.celebrateAtFarShore.bind(this);
		var goToBonusRounds = this.goToBonusRounds.bind(this);
		
		// give the boat gas when there is a correct answer.
		// this happens regardless of round (even if bonus round).
		// return a promise, because other actions happen once that's done.
		var add_gas_promise = game.internal_clock.nextTick();
		switch(score) {
			case 0:
				console.log("wrong answer");
				break;
				
			case 1:
				add_gas_promise = this.addGas();
				break;
		}	

		// on last round, check final score
		var endGame = game.end.bind(game);
		if (round.nbr === this.last_regular_round_nbr) {
			// clean up prompt.
			round.prompter.discardAll();
				
			if (current_score < 18) {
				// if final score < 18, you lose
				add_gas_promise.then(playerDrivesBoat).then(boatSinks).then(playerSwimsBack).then(endGame);
				info.continue = false;
			} else if (current_score < 20) {
				// give two bonus questions
				add_gas_promise.then(goToBonusRounds);
				info.continue = false;
			} else if (current_score === 20) { // condition is spurious at this point.
				// must be a winner! got 20 right; straight through.
				game.user_won = true;
				add_gas_promise.then(playerDrivesBoat).then(celebrateAtFarShore).then(endGame);
				info.continue = false;
			}
			
		// separate possibility of success (after 'prompt-only' round and bonus questions)
		} else if (round.nbr === this.last_regular_round_nbr + 3) {
			// clean up prompt.
			round.prompter.discardAll();
			
			if (current_score === 20) {
				// player won!
				game.user_won = true;
				add_gas_promise.then(playerDrivesBoat).then(celebrateAtFarShore).then(endGame);
				info.continue = false;
			} else {
				// player lost.
				add_gas_promise.then(playerDrivesBoat).then(boatSinks).then(playerSwimsBack).then(endGame);
				info.continue = false;
			}
			
		}
	},
	
	/*** Utility Animations. 
	 *** we make them methods of this Scene object, so we always have access to the set pieces.
	 ***/
	
	addGas: function (fill_to) {
		var current_transform, current_rotation, step;
		var _this = this;
		
		// show the gas tank above the back end of the boat.
		this.gas_tank.show();
		
		// sometimes, we get errors related to the transform not matching. 
		// try to capture them to figure out what is going on.
		try {
			// do we have the needle loaded? how to make sure? 
			// it gets loaded via AJAX w/in render(), so that must return a promise.
			current_transform = this.needle.attr("transform");
			current_rotation = current_transform.match(/rotate\((-?\d+(\.\d+)?)(,\d+(\.\d+)?)?(,\d+(\.\d+)?)?\)/);

			// convert matched rotation to a float.
			current_rotation = parseFloat(current_rotation[1]);
			step = 4.5;
			// if fill_to, fill to that number of steps
			var final_r = fill_to ? (fill_to * step) - 45 : current_rotation + step;
			
			var dfd = $.Deferred();
			$({ r: current_rotation }).delay(250).animate({ r: final_r }, 
				{ duration: 1000, 
					step: function (now) {
				  	_this.needle.attr("transform", "rotate(" + now + ",210,312)");
						// waiting for promise doesn't seem to work with this form of animate().
						if (now === current_rotation + step) {
							_this.gas_tank.hide();
						}
					}
				})
		} catch (e) {
			this.gas_tank.hide();
		} finally {
			dfd.resolve();
		}
		return dfd.promise();
	},
	
	goToBonusRounds: function () {
		this.game.newRound(21);
	},
	
	playerDrivesBoat: function () {
		this.gas_tank.hide(); // precaution.
		var dfd = $.Deferred();
		var boat_start_pos = this.boat.position().left;
		var boat_nudge = this.boat.width() / 2.0;
		var move_increment = (this.boatContainer.width() - this.boat.width()) / 20;
		var boat_end_pos = (this.game.current_score) ? (move_increment * this.game.current_score) : boat_nudge;
		var boat_speed = move_increment * 20;
		var boat_min_duration = 400; // ticks
		var boat_run_duration = (boat_speed * this.game.current_score) + boat_min_duration;
		
		this.boat
		.delay(500)
		.animate({ "left": boat_end_pos }, boat_run_duration, function () { dfd.resolve(); });
		
		// show gas being used.
		current_transform = this.needle.attr("transform");
		current_rotation = current_transform.match(/rotate\((-?\d+(\.\d+)?)(,\d+(\.\d+)?)?(,\d+(\.\d+)?)?\)/);

		// convert matched rotation to a float.
		current_rotation = parseFloat(current_rotation[1]);
		var _this = this;
		$({ r: current_rotation })
		.delay(500)
		.animate({ r: -45 }, 
						{ duration: boat_run_duration, 
							step: function (now) {
						  	_this.needle.attr("transform", "rotate(" + now + ",210,312)");
							}
						})
		return dfd.promise();
	},
	
	boatSinks: function () {
		var dfd = $.Deferred();
		this.boat
		.delay(500)
		.animate({ "top": this.boatContainer.height() }, 3500, function () { dfd.resolve(); });
		return dfd.promise();
	},
	
	playerSwimsBack: function () {
		var dfd = $.Deferred();
		
		var boat_sink_pos = this.boat.position();
		var swim_duration = boat_sink_pos.left * 20;
		// if there were no correct answers, boat_sink_pos.left is 37.5, and swim_duration is 750.
		
		this.boat.remove();
		this.boatContainer.append(this.swimmer)
		this.swimmer.css({ left: boat_sink_pos.left, top: boat_sink_pos.top });
		this.swimmer.show();
		
		if (swim_duration > 750) {
			this.swimmer.animate({ top: 10 }, 200 ); // bring swimmer partially to the surface.
			this.swimmer.animate({ left: 20 }, swim_duration, function () { dfd.resolve(); } );
		} else {
			// if there is not enough room for the swimmer to swim, just bring him to the surface and then move on.
			this.swimmer.animate({ top: 10 }, 200, function () { dfd.resolve(); } );
		}
		
		
		// fade to black, so we don't have to deal with the swimmer coming out of the water.
		var fadeout_delay = (swim_duration >= 6000) ? (swim_duration - 6000) : 0;
		this.blackBackdrop.delay(fadeout_delay).animate({ opacity: 1 }, 2500);
		
		return dfd.promise();
	},
	
	celebrateAtFarShore: function () {
		var dfd = $.Deferred();
		var scrim = $("#scrim");
		scrim.animate({
										opacity: 1
									}, 1500, function () {
			scrim.css("background-image", "../custom_img/fireworks.gif");
			dfd.resolve();
		});
		
		return dfd.promise();
	}
	 
});