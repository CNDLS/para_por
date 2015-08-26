/*
 * Game.Scene.Lake: controls animations for gas gauge, sharks, and other moving things.
 * To keep things simple, we treat the characters as set pieces that get moved about.
 */

Game.Scene.new(Game.Scene.Basic, "Lake", 
{
	finalize: function (round) {
		round.scene = this;
		
		// keep references to my set pieces.
		this.swimmer = $("#swimmer");
		this.boatContainer = $("#boat-container");
		this.boat = $("#boat");
		this.blackBackdrop = $("#blackBackdrop");
		this.needle = $("svg path#needle");
		this.gas_tank = $("#gas_tank");
		this.last_regular_round_nbr = 20;
		this.quiz_round_nbr = 24;
		this.sharkcontainer = $("#sharkcontainer");
		
		// add a cheat key.
		var _this = this;
		$(document).keypress(function (evt) {
			switch (evt.charCode) {
				case 35: // # sign. shift-3.
					// jump to round 18 (17th index).
					_this.addGas(17).then(function () {
						_this.gas_tank.hide();
						round.game.setPoints(17);
						round.abort(round.game.rounds[17], Game.clearCards);
					});
					break;
					
				case 36: // $ sign. shift-4.
					_this.addGas(19).then(function () {
						_this.gas_tank.hide();
						round.game.setPoints(19);
						round.abort(round.game.rounds[19], Game.clearCards);
					});
					break;
					
				case 37: // % sign. shift-5.
					round.abort(round.game.rounds[23], Game.clearCards);
					break;
			}
		})
	},
	
	leaveRespondToPlayer: function (evt, info) {
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
		var goBackToRoundOne = this.goBackToRoundOne.bind(this);
		var goToQuiz = this.goToQuiz.bind(this);
		var endGame = this.endGame.bind(this);
		var sharksAppear = this.sharksAppear.bind(this);
		
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
				info.continue = false;
				break;
		}	

		// if round.nbr === 17, start sharks swimming.
		// testing on round.nbr === 2
		if (round.nbr === 2) {
			sharksAppear();
		}

		// on last round, check final score
		if (round.nbr === this.last_regular_round_nbr) {
			// clean up prompt.
			round.prompter.discardAll();
				
			if (current_score < 18) {
				// if final score < 18, you lose
				add_gas_promise.then(playerDrivesBoat).then(boatSinks).then(playerSwimsBack).then(goBackToRoundOne);
				info.continue = false;
				
			} else if (current_score < 20) {
				// give two bonus questions
				add_gas_promise.then(goToBonusRounds);
				info.continue = false;
				
			} else if (current_score === 20) { // condition is spurious at this point.
				// must be a winner! got 20 right; straight through.
				game.user_won = true;
				add_gas_promise.then(playerDrivesBoat).then(celebrateAtFarShore).then(goToQuiz);
				info.continue = false;
			}
			
		// separate possibility of success (after 'prompt-only' round and bonus questions)
		} else if (round.nbr === this.last_regular_round_nbr + 3) {
			// clean up prompt.
			round.prompter.discardAll();
			
			if (current_score >= 20) {
				// player won!
				game.user_won = true;
				add_gas_promise.then(playerDrivesBoat).then(celebrateAtFarShore).then(goToQuiz);
				info.continue = false;
			} else {
				// player lost.
				add_gas_promise.then(playerDrivesBoat).then(boatSinks).then(playerSwimsBack).then(goBackToRoundOne);
				info.continue = false;
			}
			
		} else if (round.nbr === this.quiz_round_nbr) {
			info.continue = false;
			return endGame();
			
		} else if (score == 1) {
				// move the round forward once done.
				add_gas_promise.then(function () {
					round.transition();
				})
			}
	},
	
	/*** Utility Animations. 
	 *** we make them methods of this Scene object, so we always have access to the set pieces.
	 ***/
	
	addGas: function (fill_to) {
		var current_transform, current_rotation, step;
		var dfd = $.Deferred();
		
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

			var _this = this;
			$({ r: current_rotation }).delay(250).animate({ r: final_r }, 
				{ duration: 1000, 
					step: function (now) {
				  	_this.needle.attr("transform", "rotate(" + now + ",210,312)");
						// waiting for promise doesn't seem to work with this form of animate().
						if (now === final_r) {
							_this.gas_tank.hide();
							dfd.resolve();
						}
					}
				})
		} catch (e) {
			this.gas_tank.hide();
			console.warn(e);
		}
		return dfd.promise();
	},
	
	goToBonusRounds: function () {
		var dfd = $.Deferred();
		var game = this.game;
		game.current_round.transition.cancel();
		this.game.internal_clock.nextTick().then(function () {
			game.current_round.abort(game.rounds[20], game.clearCards);
			dfd.resolve();
		})
		return dfd;
	},
	
	goBackToRoundOne: function () {
		var _this = this;
		this.addGas(0).then(function () {
			_this.gas_tank.hide();
			_this.game.setPoints(0);
			_this.swimmer.remove();
			_this.boatContainer.render("#boat");
			// cancel the current transition, abort from this round to the first one.
			_this.game.current_round.transition.cancel();
			_this.blackBackdrop.animate({ opacity: 0 }, 500, function () {
				_this.game.current_round.abort(_this.game.rounds[0], _this.game.clearCards);
			});
		});
	},
	
	playerDrivesBoat: function () {
		this.gas_tank.hide(); // precaution.
		var dfd = $.Deferred();
		var boat_start_pos = this.boat.position().left;
		var boat_nudge = this.boat.width() / 2.0;
		var move_increment = (this.boatContainer.width() - this.boat.width()) / 20;
		var boat_trip_length = Math.min(this.game.current_score, 20);
		var boat_end_pos = (boat_trip_length) ? (move_increment * boat_trip_length) : boat_nudge;
		var boat_speed = move_increment * 20;
		var boat_min_duration = 400; // ticks
		var boat_run_duration = (boat_speed * boat_trip_length) + boat_min_duration;
		
		this.boat
		.delay(500)
		.animate({ "left": boat_end_pos }, boat_run_duration, function () { dfd.resolve(); });
		
		// show gas being used.
		current_transform = this.needle.attr("transform");
		current_rotation = current_transform.match(/rotate\((-?\d+(\.\d+)?)(,\d+(\.\d+)?)?(,\d+(\.\d+)?)?\)/);

		// convert matched rotation to a float.
		current_rotation = parseFloat(current_rotation[1]);
		var end_rotation = (this.game.current_score == 21) ? -40.5: -45;
		var _this = this;
		$({ r: current_rotation })
		.delay(500)
		.animate({ r: end_rotation }, 
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
		var swimmer_top = 13;
		// if there were no correct answers, boat_sink_pos.left is 37.5, and swim_duration is 750.
		
		this.boat.remove();
		this.boatContainer.append(this.swimmer)
		this.swimmer.css({ left: boat_sink_pos.left, top: boat_sink_pos.top });
		this.swimmer.show();
		
		if (swim_duration > 750) {
			this.swimmer.animate({ top: swimmer_top }, 200 ); // bring swimmer partially to the surface.
			this.swimmer.animate({ left: 20 }, swim_duration );
		} else {
			// if there is not enough room for the swimmer to swim, just bring him to the surface and then move on.
			this.swimmer.animate({ top: swimmer_top }, 200 );
		}
		
		
		// fade to black, so we don't have to deal with the swimmer coming out of the water.
		var fadeout_delay = (swim_duration >= 6000) ? (swim_duration - 6000) : 0;
		this.blackBackdrop.delay(fadeout_delay).animate({ opacity: 1 }, 2000, function () { dfd.resolve(); });
		
		return dfd.promise();
	},
	
	celebrateAtFarShore: function () {
		var dfd = $.Deferred();
		var scrim = $("#scrim");
		scrim.animate({ opacity: 1 }, 2500, function () {
			scrim.css("background-image", "../custom_img/fireworks.gif");
			// do a little color-cycling animation on the fireworks, just to show off.
			scrim.addClass("magenta_fireworks");
			setTimeout(dfd.resolve, 12500);
		});
		// darken the landscape a bit. 'night' class css should have a transition.
		$("#notSky").addClass("night");
		
		return dfd.promise();
	},
	
	goToQuiz: function () {
		this.game.current_round.transition.cancel();
		this.game.current_round.abort(this.game.rounds[23], this.game.clearCards);
	},

	endGame: function () {
		var dfd = $.Deferred();
		game.end();
		dfd.resolve();
		return dfd.promise();
	},

	sharksAppear: function () {
		// find boat
		console.log(this.boatContainer);
		console.log(this.boat);



		var shark1 = $("<div id='shark1' />");
		this.sharkcontainer.append(shark1)
		this.sharkcontainer.css("visibility", "visible");
	}
	 
});


/*
 * Game.Scene.Quiz: this is where .
 */
Game.Scene.new(Game.Scene.Basic, "Quiz",
{
	finalize: function (round) {
	}
});