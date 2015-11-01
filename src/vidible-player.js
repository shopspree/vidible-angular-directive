/**
 * Created by tomersela on 8/13/15.
 */

(function(ng) {
    'use strict';

    ng.module('vidible-module', [])
        .service('VidibleQueueLoader', ['$http', '$timeout', function($http, $timeout) {
            var VIDEO_READY_TIMEOUT = 30000;

            var VidibleLoaderQueue = {},
                queue = [],
                stratedWaiting;


            function loadScriptByVideoId(videoId, playerId, vidibleAccountId, callback) {
                var vidibleScriptUrl = 'http://delivery.vidible.tv/jsonp/pid=' + playerId + '/vid=' +
                    videoId + '/' + vidibleAccountId + '.js';

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

            function processQueue() {
                if (queue.length > 0) {
                    // Remove element from queue
                    var item = queue.shift(),
                        vidibleElement = angular.element('<div class="player vdb_player"></div>');
                    // Load the Vidible script
                    loadScriptByVideoId(
                        item.vidOptions.videoId,
                        item.vidOptions.vidiblePlayerId,
                        item.vidOptions.vidibleAccountId,
                        function(statusCode, script) {
                            if (statusCode === 200) {
                                var vidElement = ng.element(vidibleElement),
                                    s = document.createElement('script');
                                vidElement.addClass('vdb_' + item.vidOptions.vidiblePlayerId + item.vidOptions.vidibleAccountId);
                                // script tag is added with javascript becasue if added in HTML it wouldn't exectue
                                s.innerText = script;
                                vidibleElement[0].appendChild(s);
                                // Create new Vidible element
                                item.elem.append(vidibleElement);
                                waitForPlayerToBeReady(vidibleElement[0], function(player) {
                                    item.cb(player);
                                    processQueue();
                                }, VIDEO_READY_TIMEOUT);
                            } else {
                                console.error('Error loading vidable with id = ' + item.vid);
                                processQueue();
                            }
                        }
                    );
                }
            }

            VidibleLoaderQueue.queueForProcessing = function(videoId, vidiblePlayerId, vidibleAccountId, containerElement, callback) {
                queue.push({
                    vidOptions: {
                        videoId: videoId,
                        vidiblePlayerId: vidiblePlayerId,
                        vidibleAccountId: vidibleAccountId
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
        .directive('vidiblePlayer', ['$window', '$interval', 'VidibleQueueLoader',
            function($window, $interval, VidibleQueueLoader) {
                var EVENT_PREFIX = 'vidible.player.',
                    PLAYER_READY_EVENT = 'vidible.player.ready';
                var pageUniqueId = 1;

                function getVidibleEventName(vidibleEvent) {
                    // Can use this function only when a vidible script is loaded (When the player is active in our case)
                    switch (vidibleEvent) {
                        case $window.vidible.PLAYER_READY:
                            return EVENT_PREFIX + 'ready';
                        case $window.vidible.VIDEO_END:
                            return EVENT_PREFIX + 'ended';
                        case $window.vidible.VIDEO_PAUSE:
                            return EVENT_PREFIX + 'paused';
                        case $window.vidible.VIDEO_PLAY:
                            return EVENT_PREFIX + 'playing';
                        case $window.vidible.VIDEO_DATA_LOADED:
                            return EVENT_PREFIX + 'loaded';
                        case $window.vidible.VIDEO_TIMEUPDATE:
                            return EVENT_PREFIX + 'timeUpdate';
                    }
                }

                return {
                    restrict: 'EA',
                    scope: {
                        videoId: '=videoId',
                        player: '=?player',
                        playerId: '@playerId',
                        vidiblePlayerId: '@vidiblePlayerId',
                        vidibleAccountId: '@vidibleAccountId'
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
                                        broadcastEvent(getVidibleEventName(vidibleEvent), player, vidiblePlayer, data);
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
                                    eventName = EVENT_PREFIX + (newState ? 'muted' : 'unmuted');
                                    broadcastEvent(eventName, player, {muted: newState});
                                }
                                currentState = newState;
                            }, 100);
                        }

                        function initPlayer(vidiblePlayer) {

                            var player = {
                                getVidiblePlayer: function() {
                                    return vidiblePlayer;
                                },
                                getVidibleElement: function() {
                                    return element[0].querySelector('.vdb_player');
                                },
                                pause: function() {
                                    vidiblePlayer.pause();
                                },
                                play: function() {
                                    vidiblePlayer.play();
                                },
                                replay: function() {
                                    vidiblePlayer.seekTo(0);
                                    vidiblePlayer.play();
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
                                    try {
                                        return vidiblePlayer.getPlayerInfo().volume;
                                    } catch (e) {
                                        // Vidible throws an exception when calling getPlayerInfo after the playing-
                                        // video reached to an end
                                        return undefined;
                                    }
                                },
                                setVolume: function(volume) {
                                    return vidiblePlayer.volume(volume);
                                },
                                isMuted: function() {
                                    var volume = player.getVolume();
                                    if (volume === undefined || volume === null) {
                                        return undefined;
                                    }
                                    return volume === 0;
                                },
                                destroy: function() {
                                    // This method will be overridden after the player is ready
                                    console.warn('Player is not yet ready. nothing to destroy...')
                                }
                            };

                            scope.player = player;

                            registerVidiblePlayerEvents(player, vidiblePlayer);

                            // When player is ready
                            scope.$on(PLAYER_READY_EVENT, function(eventName, eventPlayer) {
                                if (eventPlayer === player) {
                                    // Monitor player's mute state
                                    var muteStateWatchInterval = watchMuteState(player);

                                    // Override player's destroy function
                                    player.destroy = function() {
                                        // Cancel mute state watch
                                        $interval.cancel(muteStateWatchInterval);
                                        destroyPlayer();
                                    };
                                }
                            });
                        }

                        function createPlayer(videoId) {
                            // Destroy player if exist
                            destroyPlayer();

                            // Create new Vidible element
                            VidibleQueueLoader.queueForProcessing(
                                videoId,
                                scope.vidiblePlayerId,
                                scope.vidibleAccountId,
                                element,
                                initPlayer
                            );
                        }

                        // Load player when the directive tag is ready
                        stopWatchingReady = scope.$watch(
                            function() {
                                // Wait until videoId is defined...
                                return (typeof scope.videoId !== 'undefined');
                            },
                            function(ready) {
                                if(ready) {
                                    stopWatchingReady();
                                    scope.$watch('videoId', function() {
                                        createPlayer(scope.videoId);
                                    });
                                }
                            });

                        scope.$on('$destroy', function() {
                            destroyPlayer();
                        });
                    }
                };
            }
        ]
    );
}(angular));
