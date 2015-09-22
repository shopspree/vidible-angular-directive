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
                    restrict: 'E',
                    replace: true,
                    template: '<div class="player vdb_player vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee"></div>',
                    scope: {
                        videoId: '@videoId'
                        //playerId: '@playerId'
                    },
                    link: function(scope, element, attrs) {
                        // Set elementId if not already defined
                        var playerId = element[0].id || attrs.videoId || 'page-unique-vidible-id-' + pageUniqeId++;
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
                                        applyBroadcast(getVidibleEventName(vidibleEvent), scope.player, data);
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
                            //destroyPlayer();


                            var vidibleDiv = getVidibleElement();
                            if (vidibleDiv.length === 0) {
                                console.error('Couldn\'t find element with id = ' + scope.playerId + '. Make sure the player directive is correctly placed in the DOM.');
                            } else {
                                // Load the Vidible script
                                var vidScript = angular.element('<script type="text/javascript-lazy" src="//delivery.vidible.tv/jsonp/pid=55c8aae9e4b0ca68372fb553/vid=' +
                                    videoId + '/55af9dcae4b02944c03a2eee.js"></script>');
                                // Create new Vidible element
                                $timeout(function() {
                                    vidibleDiv.append(vidScript);
                                    //var vidibleElement = angular.element(element);
                                    //vidibleElement.append(vidScript);
                                    waitForPlayerToBeReady(vidibleDiv[0], initPlayer);
                                }, 0);
                            }
                        }

                        function destroyPlayer() {
                            if (scope.player) {
                                scope.player.destroy();
                            }

                            var vidibleDiv = getVidibleElement();
                            if (vidibleDiv.length > 0) {
                                angular.element(vidibleDiv).remove();
                            }
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
                                        //scope.videoId = attrs.videoId;
                                        createPlayer(attrs.videoId);
                                    });
                                }
                            });

                        //scope.$on('$destroy', function () {
                        //    scope.player && scope.player.destroy();
                        //});
                    }
                };
            }
        ])
})(angular);
