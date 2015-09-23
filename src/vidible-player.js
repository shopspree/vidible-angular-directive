/**
 * Created by tomersela on 8/13/15.
 */

(function (ng) {
    'use strict';

    ng.module('vidible-module', [])
        .service('vidibleQueueLoader', ['$http', '$timeout', function ($http, $timeout) {
            var VidibleLoaderQueue = {};
            var videoReadytimeout = 5000;
            var queue = [];

            function loadScriptByVideoId(videoId, callback) {
                var vidibleScriptUrl = 'http://delivery.vidible.tv/jsonp/pid=55c8aae9e4b0ca68372fb553/vid=' +
                    videoId + '/55af9dcae4b02944c03a2eee.js';

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
                        console.error('timout while waiting to vidible script to load...');
                        console.log(div);
                        stratedWaiting = null;
                        return;
                    }
                    $timeout(function() { waitForPlayerToBeReady(div,cb, timeout); }, 0);
                }
            }

            function processQueue() {
                if (queue.length > 0) {
                    //remove element from queue
                    var item = queue.shift();
                    var vidibleElement = item.elem;

                    loadScriptByVideoId(item.vid, function(statusCode, script) {
                        if (statusCode == 200) {
                            var vidElement = ng.element(vidibleElement)
                            vidElement.addClass('vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee');
                            vidElement.append(script);
                            waitForPlayerToBeReady(vidibleElement[0], function() {
                                item.cb(vidibleElement[0]);
                                // process next video
                                processQueue();
                            }, videoReadytimeout);
                        } else {
                            console.error('Error loading vidable with id = ' + item.vid);
                            processQueue();
                        }
                    });
                }
            };

            VidibleLoaderQueue.queueForProcessing = function(vidibleElement, videoId, callback) {
                queue.push({
                    vid: videoId,
                    elem: vidibleElement,
                    cb: callback
                });

                if (queue.length > 1) {
                    return;
                }

                processQueue();
            };

            return VidibleLoaderQueue;
        }])
        .directive('vidiblePlayer', ['$timeout', 'vidibleQueueLoader',
            function($timeout, vidibleQueueLoader) {
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
                        //player: '=?player',
                        playerId: '@playerId'
                    },
                    link: function(scope, element, attrs) {
                        // Set elementId if not already defined
                        var playerId = element[0].id || attrs.playerId || 'page-unique-vidible-id-' + pageUniqueId++;
                        element[0].id = playerId;

                        function broadcastEvent() {
                            var args = Array.prototype.slice.call(arguments);
                            scope.$apply(function() {
                                scope.$emit.apply(scope, args);
                            });
                        }

                        function initPlayer(player) {
                            console.log('initPlayer');
                            scope.player = player;

                            [vidible.PLAYER_READY,
                                vidible.VIDEO_END,
                                vidible.VIDEO_PAUSE,
                                vidible.VIDEO_PLAY]
                                .forEach(function(vidibleEvent) {
                                    player.addEventListener(vidibleEvent, function(data) {
                                        broadcastEvent(getVidibleEventName(vidibleEvent), player, data);
                                    });
                                });
                        }

                        function createPlayer(videoId) {
                            // Destroy player if exist
                            destroyPlayer();

                            var vidibleElement = angular.element('<div class="player vdb_player"></div>');
                            // Create new Vidible element
                            element.append(vidibleElement);
                            vidibleQueueLoader.queueForProcessing(vidibleElement, videoId, initPlayer);
                        }

                        function destroyPlayer() {
                            scope.player && scope.player.destroy();
                            element.empty();
                        }

                        // Load player when the directive tag is ready
                        var stopWatchingReady = scope.$watch(
                            function () {
                                // Wait until videoId is defined...
                                return (typeof scope.videoId !== 'undefined');
                            },
                            function (ready) {
                                if (ready) {
                                    stopWatchingReady();
                                    scope.$watch('videoId', function () {
                                        createPlayer(scope.videoId);
                                    });
                                }
                            });

                        scope.$on('$destroy', function () {
                            destroyPlayer();
                        });
                    }
                };
            }
        ]);
})(angular);
