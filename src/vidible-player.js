/**
 * Created by tomersela on 8/13/15.
 */

(function (ng) {
    'use strict';

    var app = ng.module('vidible-module', ['ngLoadScript']);
    app
        .directive('vidiblePlayer', ['$timeout',
            function ($timeout) {
                var pageUniqeId = 1;
                var eventPrefix = 'vidible.player.';

                function getVidibleEventName(vidibleEvent) {
                    // Can use this function only when a vidible script is loaded (When the player is active in our case)
                    switch (vidibleEvent) {
                        case vidible.PLAYER_READY:
                            return eventPrefix + 'ready';
                        case vidible.VIDEO_END:
                            return eventPrefix + 'end';
                        case vidible.VIDEO_PAUSE:
                            return eventPrefix + 'pause';
                        case vidible.VIDEO_PLAY:
                            return eventPrefix + 'play';
                    }
                }

                return {
                    restrict: 'EA',
                    scope: {
                        videoId: '=videoId',
                        playerId: '@playerId'
                    },
                    link: function(scope, element, attrs) {
                        // Set elementId if not already defined
                        var playerId = element[0].id || attrs.playerId || 'page-unique-vidible-id-' + pageUniqeId++;
                        element[0].id = playerId;

                        function applyBroadcast () {
                            var args = Array.prototype.slice.call(arguments);
                            scope.$apply(function () {
                                scope.$emit.apply(scope, args);
                            });
                        }

                        function onPlayerError(event) {
                            applyBroadcast(eventPrefix + 'error', scope.player, event);
                        }

                        function initPlayer(player) {
                            [vidible.PLAYER_READY,
                                vidible.VIDEO_END,
                                vidible.VIDEO_PAUSE,
                                vidible.VIDEO_PLAY]
                                .forEach(function(vidibleEvent) {
                                    player.addEventListener(vidibleEvent, function(data) {
                                        applyBroadcast(getVidibleEventName(vidibleEvent), player, data);
                                    });
                                });
                        }

                        function waitForPlayerToBeReady(div, cb) {
                            if (div.vdb_Player) {
                                cb(div.vdb_Player);
                            } else {
                                $timeout(function() { waitForPlayerToBeReady(div,cb); }, 0);
                            }
                        }

                        function getVidibleElement() {
                            return angular.element(document.getElementById(playerId));
                        }

                        function createPlayer(videoId) {
                            // destroy player if exist
                            destroyPlayer();

                            var vidibleElement = angular.element('<div class="player vdb_player vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee"></div>');
                            // Load the Vidible script
                            var vidScript = angular.element('<script type="text/javascript-lazy" src="//delivery.vidible.tv/jsonp/pid=55c8aae9e4b0ca68372fb553/vid=' +
                                videoId + '/55af9dcae4b02944c03a2eee.js"></script>');
                            vidibleElement.append(vidScript);

                            // Create new Vidible element
                            $timeout(function() {
                                element.append(vidibleElement);
                                waitForPlayerToBeReady(vidibleElement[0], initPlayer);
                            }, 0);
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
                                    //scope.$watch(function() {
                                    //    return element.attr('video-id');
                                    //}, function (videoId) {
                                    //    createPlayer(videoId);
                                    //});
                                }
                            });

                        scope.$on('$destroy', function () {
                            destroyPlayer();
                        });
                    }
                };
            }
        ])
})(angular);
