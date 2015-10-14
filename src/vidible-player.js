/**
 * Created by tomersela on 8/13/15.
 */

(function(ng) {
    'use strict';

    ng.module('vidible-module',[])
        .service('vidibleQueueLoader', ['$http', '$timeout', function($http, $timeout) {
            var VidibleLoaderQueue = {};
            var videoReadyTimeout = 5000;
            var queue = [];

            var kAutoplayVidiblePlayer = '55c8aae9e4b0ca68372fb553';
            var kNoAutoplayVidiblePlayer = '55e6e684e4b061356c07ceb6';
            var kSpreeVidibleID = '55af9dcae4b02944c03a2eee';


            function loadScriptByVideoId(videoId,playerId, callback) {
                var vidibleScriptUrl = 'http://delivery.vidible.tv/jsonp/pid=' + playerId + '/vid=' +
                    videoId + '/' + kSpreeVidibleID + '.js';

                $http.get(vidibleScriptUrl).
                    then(function(response) {
                        callback(response.status, '<script>' + response.data + '</script>');
                    }, function(response) {
                        callback(response.status, null);
                    });
            }

            var stratedWaiting = null;
            function waitForPlayerToBeReady(div, cb, timeout) {
                if (!stratedWaiting) {
                    stratedWaiting = new Date().getTime();
                }
                if (div.vdb_Player) {
                    cb(div.vdb_Player);
                    stratedWaiting = null;
                } else {
                    var now = new Date().getTime();
                    var time = now - stratedWaiting;
                    if (time >= timeout) {
                        console.error('Timeout while waiting to vidible script to load...');
                        console.log(div);
                        stratedWaiting = null;
                        return;
                    }
                    $timeout(function() { waitForPlayerToBeReady(div,cb, timeout); }, 0);
                }
            }

            function getAppropriatePlayer(isAutoPlayEnabled)
            {
                return isAutoPlayEnabled ? kAutoplayVidiblePlayer : kNoAutoplayVidiblePlayer;
            }

            function processQueue() {
                if (queue.length > 0) {
                    // Remove element from queue
                    var item = queue.shift();

                    var vidibleElement = angular.element('<div class="player vdb_player"></div>');
                    // Load the Vidible script
                    loadScriptByVideoId(
                        item.vidOptions.videoId,
                        getAppropriatePlayer(item.vidOptions.autoplay),
                        function (statusCode, script) {
                            if (statusCode == 200) {
                                var vidElement = ng.element(vidibleElement)
                                vidElement.addClass('vdb_' + getAppropriatePlayer(item.vidOptions.autoplay) + kSpreeVidibleID);
                                vidibleElement.append(script);

                                // Create new Vidible element
                                item.elem.append(vidibleElement);
                                waitForPlayerToBeReady(vidibleElement[0], function (player) {
                                    item.cb(player)
                                    processQueue();
                                }, videoReadyTimeout);
                            } else {
                                console.error('Error loading vidable with id = ' + item.vid);
                                processQueue();
                            }
                        });
                }
            };

            VidibleLoaderQueue.queueForProcessing = function(videoId,isAutoplay, containerElement, callback) {
                queue.push({
                    vidOptions: {
                        videoId:videoId,
                        autoplay:isAutoplay
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
        .factory('fullscreen',function() {
            return {
                // full screen handling
                isInFullScreen : function() {
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
        .directive('vidiblePlayer', ['$timeout', '$interval', 'vidibleQueueLoader','fullscreen',
            function($timeout, $interval, vidibleQueueLoader,fullscreen) {
                var pageUniqueId = 1;
                var eventPrefix = 'vidible.player.';

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
                        var playerId = element[0].id || attrs.playerId || 'page-unique-vidible-id-' + pageUniqueId++;
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
                            scope.player && scope.player.getVidiblePlayer() && scope.player.getVidiblePlayer().destroy();
                            element.empty();
                        }

                        function watchMuteState(player) {
                            var currentState = player.isMuted();
                            return $interval(function() {
                                var newState = player.isMuted();
                                if(newState == undefined)
                                    return;

                                if(currentState !== undefined && currentState !== newState) {
                                    var eventName = eventPrefix + (newState ? 'muted' : 'unmuted');
                                    broadcastEvent(eventName, player, {muted: newState});
                                }
                                currentState = newState;
                            }, 0);
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
                                var vidibleFrameDocument = vidibleFrame ? vidibleFrame.contentDocument:null;

                                if (!vidibleFrameDocument)
                                    return;
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
                                pause: function () {
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
                                    vidiblePlayer.mute()
                                },
                                unmute: function() {
                                    if (scope.player.isMuted()) {
                                        vidiblePlayer.mute();
                                    }
                                },
                                getVolume: function() {
                                    return vidiblePlayer.getPlayerInfo().volume;
                                },
                                isMuted: function () {
                                    var volume = vidiblePlayer.getPlayerInfo().volume;
                                    if(volume === undefined || volume == null)
                                        return undefined;
                                    else
                                        return vidiblePlayer.getPlayerInfo().volume === 0;
                                }
                            };

                            scope.player = player;

                            registerVidiblePlayerEvents(player, vidiblePlayer);

                            // Monitor player's mute state
                            var muteStateWatchPromise = watchMuteState(player);

                            // track full screen to fit frame when coming back
                            startFullScreenTrackingForVidibleFrameFitting();

                            // Adding destroy function to player
                            player.destroy = function() {
                                // Cancel mute state watch
                                $interval.cancel(muteStateWatchPromise);
                                endFullScreenTrackingForVidibleFrameFitting();
                                destroyPlayer();
                            }
                        }

                        function createPlayer(videoId) {
                            // Destroy player if exist
                            destroyPlayer();

                            // Create new Vidible element
                            vidibleQueueLoader.queueForProcessing(
                                videoId,
                                scope.autoplay,
                                element,
                                initPlayer);
                        }

                        // Load player when the directive tag is ready
                        var stopWatchingReady = scope.$watch(
                            function() {
                                // Wait until videoId is defined...
                                return (typeof scope.videoId !== 'undefined');
                            },
                            function(ready) {
                                if(ready) {
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
                                                createPlayer(scope.videoId);
                                            };
                                            fullscreen.addFullScreenEventLisener(fullScreenHandler);
                                        } else {
                                            createPlayer(scope.videoId);
                                        }


                                    });
                                }
                            });

                        scope.$on('$destroy', function() {
                            destroyPlayer();
                        });
                    }
                };
            }
        ])
})(angular);
