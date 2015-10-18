/**
 * Created by tomersela on 8/13/15.
 */

(function (ng) {
    'use strict';

    ng.module('vidible-module', [])
        .service('vidibleQueueLoader', ['$http', '$timeout', function ($http, $timeout) {
            var VidibleLoaderQueue = {},
                videoReadyTimeout = 5000,
                queue = [],
                kAutoplayVidiblePlayer = '55c8aae9e4b0ca68372fb553',
                kNoAutoplayVidiblePlayer = '55e6e684e4b061356c07ceb6',
                kSpreeVidibleID = '55af9dcae4b02944c03a2eee';


            function loadScriptByVideoId(videoId, playerId, callback) {
                var vidibleScriptUrl = 'http://delivery.vidible.tv/jsonp/pid=' + playerId + '/vid=' +
                    videoId + '/' + kSpreeVidibleID + '.js';

                $http.get(vidibleScriptUrl).
                    then(function (response) {
                        callback(response.status, response.data);
                    }, function (response) {
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
                    var now = new Date().getTime(),
                        time = now - stratedWaiting;
                    if (time >= timeout) {
                        console.error('Timeout while waiting to vidible script to load...');
                        console.log(div);
                        stratedWaiting = null;
                        return;
                    }
                    $timeout(function () { waitForPlayerToBeReady(div,cb, timeout); }, 0);
                }
            }

            function getAppropriatePlayer(isAutoPlayEnabled)
            {
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
                        function (statusCode, script) {
                            if (statusCode === 200) {
                                var vidElement = ng.element(vidibleElement),
                                    s = document.createElement('script');
                                vidElement.addClass('vdb_' + getAppropriatePlayer(item.vidOptions.autoplay) + kSpreeVidibleID);
                                // script tag is added with javascript becasue if added in HTML it wouldn't exectue
                                s.innerText = script;
                                vidibleElement[0].appendChild(s);
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
                        }
                    );
                }
            }

            VidibleLoaderQueue.queueForProcessing = function (videoId, isAutoplay, containerElement, callback) {
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
        .directive('vidiblePlayer', ['$timeout', '$interval', 'vidibleQueueLoader',
            function ($timeout, $interval, vidibleQueueLoader) {
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
                    link: function (scope, element, attrs) {
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
                                .forEach(function (vidibleEvent) {
                                    vidiblePlayer.addEventListener(vidibleEvent, function (data) {
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
                            return $interval(function () {
                                var newState = player.isMuted();
                                if (newState === undefined) {
                                    return;
                                }
                                if (currentState !== undefined && currentState !== newState) {
                                    eventName = eventPrefix + (newState ? 'muted' : 'unmuted');
                                    broadcastEvent(eventName, player, {muted: newState});
                                }
                                currentState = newState;
                            }, 0);
                        }

                        function initPlayer(vidiblePlayer) {

                            var player = {
                                getVidiblePlayer: function () {
                                    return vidiblePlayer;
                                },
                                pause: function () {
                                    vidiblePlayer.pause();
                                },
                                play: function () {
                                    vidiblePlayer.play();
                                },
                                replay: function () {
                                    // simple seek and play is buggy (throws exceptions from vidible), so i'm just recreating the player
                                    scope.autoplay = true;
                                    createPlayer(scope.videoId);
                                },
                                mute: function () {
                                    vidiblePlayer.mute();
                                },
                                unmute: function () {
                                    if (scope.player.isMuted()) {
                                        vidiblePlayer.mute();
                                    }
                                },
                                getVolume: function () {
                                    return vidiblePlayer.getPlayerInfo().volume;
                                },
                                isMuted: function () {
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

                            // Adding destroy function to player
                            player.destroy = function () {
                                // Cancel mute state watch
                                $interval.cancel(muteStateWatchPromise);
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

                        // Load player when the directive tag is ready
                        stopWatchingReady = scope.$watch(
                            function () {
                                // Wait until videoId is defined...
                                return (typeof scope.videoId !== 'undefined');
                            },
                            function (ready) {
                                if (ready) {
                                    stopWatchingReady();
                                    scope.$watch('videoId', function() {
                                        if (scope.videoId) {
                                            createPlayer(scope.videoId);
                                        } else {
                                            emptyHTML();
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
