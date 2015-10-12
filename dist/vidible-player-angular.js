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

/*global angular */
(function (ng) {
    'use strict';

    var app = ng.module('ngLoadScript', []);

    app.directive('script', function() {
        return {
            restrict: 'E',
            scope: false,
            link: function(scope, elem, attr)
            {
                if (attr.type==='text/javascript-lazy')
                {
                    var s = document.createElement("script");
                    s.type = "text/javascript";
                    var src = elem.attr('src');
                    if(src!==undefined)
                    {
                        s.src = src;
                    }
                    else
                    {
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

(function(ng) {
    'use strict';

    ng.module('vidible-module', [])
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

            function playerForAutoplay(inAutoplay)
            {
                return inAutoplay ? kAutoplayVidiblePlayer : kNoAutoplayVidiblePlayer;
            }

            function processQueue() {
                if (queue.length > 0) {
                    // Remove element from queue
                    var item = queue.shift();

                    var vidibleElement = angular.element('<div class="player vdb_player"></div>');
                    // Load the Vidible script
                    loadScriptByVideoId(
                        item.vidOptions.videoId,
                        playerForAutoplay(item.vidOptions.autoplay),
                        function (statusCode, script) {
                        if (statusCode == 200) {
                            var vidElement = ng.element(vidibleElement)
                            vidElement.addClass('vdb_' + playerForAutoplay(item.vidOptions.autoplay) + kSpreeVidibleID);
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

            VidibleLoaderQueue.queueForProcessing = function(videoOptions, containerElement, callback) {
                queue.push({
                    vidOptions: videoOptions,
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
            function($timeout, $interval, vidibleQueueLoader) {
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
                                vidible.VIDEO_END,
                                vidible.VIDEO_PAUSE,
                                vidible.VIDEO_PLAY]
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

                                if (currentState !== newState) {
                                    var eventName = eventPrefix + (newState ? 'muted' : 'unmuted');
                                    broadcastEvent(eventName, player, {muted: newState});
                                }
                                currentState = newState;
                            }, 0);
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
                                    try {
                                        return vidiblePlayer.getPlayerInfo().volume === 0;
                                    } catch (e) {
                                        return undefined;
                                    }
                                }
                            };

                            scope.player = player;

                            registerVidiblePlayerEvents(player, vidiblePlayer);

                            // Monitor player's mute state
                            var muteStateWatchPromise = watchMuteState(player);

                            // Adding destroy function to player
                            player.destroy = function() {
                                // Cancel mute state watch
                                $interval.cancel(muteStateWatchPromise);
                                destroyPlayer();
                            }
                        }

                        function createPlayer(videoId) {
                            // Destroy player if exist
                            destroyPlayer();

                            // Create new Vidible element
                            vidibleQueueLoader.queueForProcessing(
                                {
                                    videoId:videoId,
                                    autoplay:scope.autoplay
                                },
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
        ])
})(angular);
