Loading dynamically more than one Vidble Tags
=============================================

###There's a problem with Vidible when updating the document dynamically with more than one player's Tag-API at the same time. The following code will run and play two videos without any problem in case it's already placed in the DOM:###

<code>

    <div id="vidiblePlayer1" class="vdb_player vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee">
    &emsp;<script type="text/javascript" src="//delivery.vidible.tv/jsonp/pid=55c8aae9e4b0ca68372fb553/vid=55be0899e4b02f074914330f/55af9dcae4b02944c03a2eee.js"&btl<\/script>
    </div>
    <div id="vidiblePlayer2" class="vdb_player vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee">
    &emsp;<script type="text/javascript" src="//delivery.vidible.tv/jsonp/pid=55c8aae9e4b0ca68372fb553/vid=55be318be4b02f07491434ac/55af9dcae4b02944c03a2eee.js"&btl<\/script>
    </div>
    
</code>

But if we append an element in the DOM with the above elements using javascript, we may experience a weird behavior - the videos switch place some of the time.
For example, the following jQuery code will show the right order of videos in most cases:
<code>

    <body>
    <div id="container"></div>
    <script src="https://ajax.googleapis.com/ajax/libs/jquery/1.11.3/jquery.min.js"></script>;
    <script>
        var vidElements =
            '<div id="vidiblePlayer1" class="vdb_player vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee">' +
            '   <script type="text/javascript" src="//delivery.vidible.tv/jsonp/pid=55c8aae9e4b0ca68372fb553/vid=55be0899e4b02f074914330f/55af9dcae4b02944c03a2eee.js"><\/script>' +
            '</div>' +
            '<div id="vidiblePlayer2" class="vdb_player vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee">' +
                '<script type="text/javascript" src="//delivery.vidible.tv/jsonp/pid=55c8aae9e4b0ca68372fb553/vid=55be318be4b02f07491434ac/55af9dcae4b02944c03a2eee.js"><\/script>' +
            '</div>';
      $('#container').append(vidElements);
    </script>
    </body>

</code>
**but after couple of browser refreshes we will see a situation where the videos placed in the opposite order (movie with vid = 55be0899e4b02f074914330f placed second).
The root cause of it is a combination between Vidible implementation and the behavior of loading scripts dynamically.**

Let's examine what happen in case the script already in the DOM, it will help us understand the difference between that and the dynamic loading case:

1. Each script is blocking the page load, and therefore only one will run at any given time.
First - the script in the first tag will run:
    - The script finds the first element with class "vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee" in the document.
    - remove the "vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee" class from the element.
    - append the element with another script that creates the vidible iframe.
    
    when the first script finish, the DOM will look like this:
    <code>
    
        <div id="vidiblePlayer1" class="vdb_player ">
            <script type="text/javascript" src="//delivery.vidible.tv/jsonp/pid=55c8aae9e4b0ca68372fb553/vid=55be0899e4b02f074914330f/55af9dcae4b02944c03a2eee.js">
            </script><script type="text/javascript" src="http://cdn.vidible.tv/prod/js/vidible-min.js?pid=55c8aae9e4b0ca68372fb553&amp;bcid=55af9dcae4b02944c03a2eee&amp;ifr=false&amp;cb=0.9543816866353154&amp;r=http%3A%2F%2Flocalhost%3A63342%2Fvidible-angular-directive%2Fdemo%2Ftest.html"></script>
        </div>
    
    </code>
    * please note that the second tag is not yet in the DOM as scripts placed in the DOM blocks the page load.
    
2. The script in the second tag runs with the same steps - will find the first element with "vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee" class,
    remove the class and append the element with another script.
     
Now let's examine a scenario of loading the Vidible API Tags dynamically to the DOM:
Both scripts will run simultaneously and therefore we can have a race condition for selecting the first element with the "vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee" class.
In most cases the first script will run it's steps before the second script. but in other cases the second script will run before:

1. The second script run first and finds the first element with class "vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee" (the first API tag),
removes the class and update it with the second video (with id = "55be318be4b02f07491434ac").

2. Then the first script run. And since the second script removed the class from the first tag, the first script will "catch" the second tag API and will place the first video there.

##Possible workarounds##

####Workaround - Option I####
Have a global queue for the vidible player directive which will manage the Vidible script loads one after the other:

For each directive process -

1. Initially there will be no "vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee" class attached to the Vidible element and no script element inside it.
2. The directive code will register the vid to a global queue service with a unique id of the current directive element.

The queue service will work as follows every time it gets called:

1. If the queue currently process an item it will add the new item (vid + element id touple) to the queue.
   if not it will process the item (jump to step 3)
2. Every time the queue finish processing an item it will check the queue and pop out the next item for processing until the queue is empty.
3. The queue will take the next item for processing and will find the element with id as specified in the item.
   Then it will update it with the vidible player class - "vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee".
4. We will run http get and load the vidible script.
5. In case we got a response status of 200 we will append the Vidible tag with the script element.
   Otherwise we will remove the class from the vidible element.
6. Then move on to the next Vidible item.

Queue pseudu code:
<code>

    var queue = [];
    function queueForProcessing(videoId, vidibleElementId) {
        queue.push({
            vid: videoId,
            elemId: vidibleElementId
        });
        
        if (queue.length > 1) {
            return;
        }
        
        processQueue();
    }

    function processQueue() {
        if (queue.length > 0) {
            //remove element from queue
            var item = queue.shift;
            var vidibleElement = document.getElementById(item.elemId);
            loadScriptByVideoId(vidibleElement, item.vid, function(statusCode, script) {
                if (statusCode == 200) {
                    vidibleElement.addClass('vdb_55c8aae9e4b0ca68372fb55355af9dcae4b02944c03a2eee');
                    vidibleElement.append(script);
                    waitForPlayerToBeReady(vidibleElement, 5000, function() {
                        // process next video
                        processQueue();
                    });
                } else {
                    processQueue();
                }
            });
        }
    }
    
    function loadScriptByVideoId(vidibleElement, videoId, callback) {
        // The reason we're using http get instead of just appending the vidible element with a script tag
        // is because we want to know if the script is available, and if not process to the next video in the queue
        // instead of waiting for the player to be ready (for example - if we get 404 immediately there is no reason to wait)
        var vidibleScriptUrl = ... // compose url using videoId
        http.get(vidibleScriptUrl, function(response) {
            callback(response.statusCode, response.content);
        }
    }

</code>
####Workaround - Option II####
Working with iframes.

- Each vidible directive will reside in it's own iframe.
- Event's will propagate to the iframe container
- Commands and queries will run from the parent container to the directive inside the iframe.

