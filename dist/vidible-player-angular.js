/*
 *  Angular LoadScript
 *
 *  Let angular load and execute lazy javascript from partials!
 *
 *  This module is the result of  this issue: "1.2.0rc1 regression: script tags not loaded via ngInclude"
 *  Issue url: https://github.com/angular/angular.js/issues/3756
 *
 *  As of Angular 1.2.0 the ngInclude scripts does not permit execution of javascript from included partials.
 *  This little module execute code inside script tags with "javascript-lazy" attribute after partial loading,
 *  thus re-enabling this feature.
 *
 *  ( please have a look at the issue comments, this angular feature was never planned nor included properly,
 *  was only a drawback of using jQuery for partial inclusion )
 *
 *  This angular module have been created by @endorama (https://github.com/endorama) based upon the code
 *  posted by @olostan (https://github.com/olostan)
 *
 *  Simply add this file, load ngLoadScript module as application dependency and use type="text/javascript-lazy"
 *  as type for script you which to load lazily in partials.
 *
 * License: 2013 - released to the Public Domain.
 */

'use strict';

/*global angular */
(function(ng) {
    var app = ng.module('ngLoadScript', []);

    app.directive('script', function() {
        return {
            restrict: 'E',
            scope: false,
            link: function(scope, elem, attr) {
                if (attr.type === 'text/javascript-lazy') {
                    var s = document.createElement("script");
                    s.type = "text/javascript";
                    var src = elem.attr('src');
                    if (src !== undefined) {
                        s.src = src;
                    }
                    else {
                        var code = elem.text();
                        s.text = code;
                    }
                    document.head.appendChild(s);
                    elem.remove();
                }
            }
        };
    });

}(angular));

/**
 * Created by tomersela on 8/13/15.
 */

'use strict';

(function(ng) {

    ng.module('vidible-module', [])
        .service('vidibleQueueLoader', ['$http', '$timeout', function($http, $timeout) {
            var VidibleLoaderQueue = {},
                videoReadyTimeout = 5000,
                queue = [],
                kAutoplayVidiblePlayer = '55c8aae9e4b0ca68372fb553',
                kNoAutoplayVidiblePlayer = '55e6e684e4b061356c07ceb6',
                kSpreeVidibleID = '55af9dcae4b02944c03a2eee',
                stratedWaiting;


            function loadScriptByVideoId(videoId, playerId, callback) {
                var vidibleScriptUrl = 'http://delivery.vidible.tv/jsonp/pid=' + playerId + '/vid=' +
                    videoId + '/' + kSpreeVidibleID + '.js';

                $http.get(vidibleScriptUrl).
                    then(function(response) {
                        callback(response.status, response.data);
                    }, function(response) {
                        callback(response.status, null);
                    });
            }

            stratedWaiting = null;
            function waitForPlayerToBeReady(div, cb, timeout) {
                if (!stratedWaiting) {
                    stratedWaiting = new Date().getTime();
                }
                if (div.vdb_Player) {
                    cb(div.vdb_Player);
                    stratedWaiting = null;
                } else {
                    var now = new Date().getTime(),
                        time = now - stratedWaiting;
                    if (time >= timeout) {
                        console.error('Timeout while waiting to vidible script to load...');
                        console.log(div);
                        stratedWaiting = null;
                        return;
                    }
                    $timeout(function() { waitForPlayerToBeReady(div, cb, timeout); }, 0);
                }
            }

            function getAppropriatePlayer(isAutoPlayEnabled) {
                return isAutoPlayEnabled ? kAutoplayVidiblePlayer : kNoAutoplayVidiblePlayer;
            }

            function processQueue() {
                if (queue.length > 0) {
                    // Remove element from queue
                    var item = queue.shift(),
                        vidibleElement = angular.element('<div class="player vdb_player"></div>');
                    // Load the Vidible script
                    loadScriptByVideoId(
                        item.vidOptions.videoId,
                        getAppropriatePlayer(item.vidOptions.autoplay),
                        function(statusCode, script) {
                            if (statusCode === 200) {
                                var vidElement = ng.element(vidibleElement),
                                    s = document.createElement('script');
                                vidElement.addClass('vdb_' + getAppropriatePlayer(item.vidOptions.autoplay) + kSpreeVidibleID);
                                // script tag is added with javascript becasue if added in HTML it wouldn't exectue
                                s.innerText = script;
                                vidibleElement[0].appendChild(s);
                                // Create new Vidible element
                                item.elem.append(vidibleElement);
                                waitForPlayerToBeReady(vidibleElement[0], function(player) {
                                    item.cb(player)
                                    processQueue();
                                }, videoReadyTimeout);
                            } else {
                                console.error('Error loading vidable with id = ' + item.vid);
                                processQueue();
                            }
                        }
                    );
                }
            }

            VidibleLoaderQueue.queueForProcessing = function(videoId, isAutoplay, containerElement, callback) {
                queue.push({
                    vidOptions: {
                        videoId: videoId,
                        autoplay: isAutoplay
                    },
                    elem: containerElement,
                    cb: callback
                });

                if (queue.length > 1) {
                    return;
                }

                processQueue();
            };

            return VidibleLoaderQueue;
        }])
        .factory('fullscreen', function() {
            return {
                // full screen handling
                isInFullScreen: function() {
                    return document.fullscreenElement ||
                        document.webkitFullscreenElement ||
                        document.mozFullScreenElement ||
                        document.msFullscreenElement;
                },

                removeFullScreenEventLisener: function(fullScreenHandler) {
                    document.removeEventListener("fullscreenchange", fullScreenHandler);
                    document.removeEventListener("webkitfullscreenchange", fullScreenHandler);
                    document.removeEventListener("mozfullscreenchange", fullScreenHandler);
                    document.removeEventListener("MSFullscreenChange", fullScreenHandler);
                },

                addFullScreenEventLisener: function(fullScreenHandler) {
                    document.addEventListener("fullscreenchange", fullScreenHandler);
                    document.addEventListener("webkitfullscreenchange", fullScreenHandler);
                    document.addEventListener("mozfullscreenchange", fullScreenHandler);
                    document.addEventListener("MSFullscreenChange", fullScreenHandler);
                }
            };
        })
        .directive('vidiblePlayer', ['$interval', 'vidibleQueueLoader', 'fullscreen',
            function($interval, vidibleQueueLoader, fullscreen) {
                var pageUniqueId = 1,
                    eventPrefix = 'vidible.player.';

                function getVidibleEventName(vidibleEvent) {
                    // Can use this function only when a vidible script is loaded (When the player is active in our case)
                    switch (vidibleEvent) {
                        case vidible.PLAYER_READY:
                            return eventPrefix + 'ready';
                        case vidible.VIDEO_END:
                            return eventPrefix + 'ended';
                        case vidible.VIDEO_PAUSE:
                            return eventPrefix + 'paused';
                        case vidible.VIDEO_PLAY:
                            return eventPrefix + 'playing';
                        case vidible.VIDEO_DATA_LOADED:
                            return eventPrefix + 'loaded';
                        case vidible.VIDEO_TIMEUPDATE:
                            return eventPrefix + 'timeUpdate';
                    }
                }

                return {
                    restrict: 'EA',
                    scope: {
                        videoId: '=videoId',
                        player: '=?',
                        playerId: '@playerId',
                        autoplay: '=?autoplay'
                    },
                    link: function(scope, element, attrs) {
                        // Set elementId if not already defined
                        var playerId = element[0].id || attrs.playerId || 'page-unique-vidible-id-' + pageUniqueId++,
                            stopWatchingReady;

                        element[0].id = playerId;

                        function broadcastEvent() {
                            var args = Array.prototype.slice.call(arguments);
                            scope.$emit.apply(scope, args);
                        }

                        function registerVidiblePlayerEvents(player, vidiblePlayer) {
                            // Register player events
                            [vidible.PLAYER_READY,
                                vidible.VIDEO_DATA_LOADED,
                                vidible.VIDEO_PLAY,
                                vidible.VIDEO_PAUSE,
                                vidible.VIDEO_END,
                                vidible.VIDEO_TIMEUPDATE]
                                .forEach(function(vidibleEvent) {
                                    vidiblePlayer.addEventListener(vidibleEvent, function(data) {
                                        broadcastEvent(getVidibleEventName(vidibleEvent), vidiblePlayer, data);
                                    });
                                });
                        }

                        function destroyPlayer() {
                            if (scope.player && scope.player.getVidiblePlayer()) {
                                scope.player.getVidiblePlayer().destroy();
                            }
                            element.empty();
                        }

                        function watchMuteState(player) {
                            var currentState = player.isMuted(),
                                eventName;
                            return $interval(function() {
                                var newState = player.isMuted();
                                if (newState === undefined) {
                                    return;
                                }
                                if (currentState !== undefined && currentState !== newState) {
                                    eventName = eventPrefix + (newState ? 'muted' : 'unmuted');
                                    broadcastEvent(eventName, player, {muted: newState});
                                }
                                currentState = newState;
                            }, 100);
                        }

                        // full screen handling

                        // treat vidible screen fitting when getting back from full screen
                        function fitVidibleScreenSizeBackFromFullScreen() {
                            if (!fullscreen.isInFullScreen()) {
                                // full screen exit. at least in chrome the internal html element
                                // of vidible changes its dimensions to be fixed pixels, killing
                                // all chances of responsiveness.
                                // so i'm forcing

                                var vidibleElement = element[0].querySelector('.vdb_player');
                                var vidibleFrame = vidibleElement.querySelector('iframe');
                                var vidibleFrameDocument = vidibleFrame ? vidibleFrame.contentDocument : null;

                                if (!vidibleFrameDocument) {
                                    return;
                                }
                                var htmlPlayer = vidibleFrameDocument.querySelector('#AolHtml5Player');
                                if (htmlPlayer) {
                                    htmlPlayer.style.width = '100%';
                                    htmlPlayer.style.height = '100%';
                                }

                            }
                        }

                        function startFullScreenTrackingForVidibleFrameFitting() {
                            fullscreen.addFullScreenEventLisener(fitVidibleScreenSizeBackFromFullScreen);
                        }


                        function endFullScreenTrackingForVidibleFrameFitting() {
                            fullscreen.removeFullScreenEventLisener(fitVidibleScreenSizeBackFromFullScreen);
                        }

                        function initPlayer(vidiblePlayer) {

                            var player = {
                                    getVidiblePlayer: function() {
                                        return vidiblePlayer;
                                    },
                                    pause: function() {
                                        vidiblePlayer.pause();
                                    },
                                    play: function() {
                                        vidiblePlayer.play();
                                    },
                                    replay: function() {
                                        // simple seek and play is buggy (throws exceptions from vidible), so i'm just recreating the player
                                        scope.autoplay = true;
                                        createPlayer(scope.videoId);
                                    },
                                    mute: function() {
                                        vidiblePlayer.mute();
                                    },
                                    unmute: function() {
                                        if (scope.player.isMuted()) {
                                            vidiblePlayer.mute();
                                        }
                                    },
                                    getVolume: function() {
                                        return vidiblePlayer.getPlayerInfo().volume;
                                    },
                                    isMuted: function() {
                                        var volume = vidiblePlayer.getPlayerInfo().volume;
                                        if (volume === undefined || volume === null) {
                                            return undefined;
                                        }
                                        return vidiblePlayer.getPlayerInfo().volume === 0;
                                    }
                                },
                                muteStateWatchPromise;

                            scope.player = player;

                            registerVidiblePlayerEvents(player, vidiblePlayer);

                            // Monitor player's mute state
                            muteStateWatchPromise = watchMuteState(player);

                            // Track full screen to fit frame when coming back
                            startFullScreenTrackingForVidibleFrameFitting();

                            // Adding destroy function to player
                            player.destroy = function() {
                                // Cancel mute state watch
                                $interval.cancel(muteStateWatchPromise);
                                endFullScreenTrackingForVidibleFrameFitting();
                                destroyPlayer();
                            };
                        }

                        function createPlayer(videoId) {
                            // Destroy player if exist
                            destroyPlayer();

                            // Create new Vidible element
                            vidibleQueueLoader.queueForProcessing(
                                videoId,
                                scope.autoplay,
                                element,
                                initPlayer
                            );
                        }

                        function emptyHTML() {
                            element.innerHTML = '';
                        }

                        function createElementContent(videoId) {
                            if (videoId) {
                                createPlayer(videoId);
                            } else {
                                emptyHTML();
                            }
                        }

                        // Load player when the directive tag is ready
                        stopWatchingReady = scope.$watch(
                            function() {
                                // Wait until videoId is defined...
                                return (typeof scope.videoId !== 'undefined');
                            },
                            function(ready) {
                                if (ready) {
                                    stopWatchingReady();
                                    scope.$watch('videoId', function() {

                                        if (fullscreen.isInFullScreen()) {
                                            /* moving to the next video.

                                             when in full screen wait to get out of it to move to the next video.
                                             i'm getting grave display issues in chrome and safari if i don't.
                                             On chrome the spree-ctrl.html takes over the webpage
                                             on safari the absolute positioned elements all change their parent
                                             offset.
                                             */

                                            var fullScreenHandler = function() {
                                                fullscreen.removeFullScreenEventLisener(fullScreenHandler);
                                                createElementContent(scope.videoId);
                                            };
                                            fullscreen.addFullScreenEventLisener(fullScreenHandler);
                                        } else {
                                            createElementContent(scope.videoId);
                                        }
                                    });
                                }
                            }
                        );

                        scope.$on('$destroy', function() {
                            destroyPlayer();
                        });
                    }
                };
            }
        ]
    );
}(angular));
