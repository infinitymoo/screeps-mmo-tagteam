var roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            var targetRoom = creep.memory.targetRoom;
            if(targetRoom) {
                var result;
                var controller;
                var roomObject = Game.rooms[targetRoom];

                if(roomObject) {
                    controller = roomObject.controller;
                }
                // if can't see room, assume its because we're blind to it
                else {
                    result = creep.travelTo(new RoomPosition(25,25,targetRoom),{swampCost:1,range:1});
                    return;
                }

                //sometimes we can see the room we must go to but we're not there yet
                if(targetRoom != creep.room.name) {
                    var result;
                    if(controller)
                        result = creep.travelTo(controller);
                    else // just in case but probably never called
                        result = creep.travelTo(new RoomPosition(25,25,targetRoom),{ignorecreeps:true,swampCost:1,range:1});
                    return;
                }
                else {
                    if(controller) {
                        var result = creep.reserveController(controller);
                        
                        if(result == ERR_NOT_IN_RANGE) {
                            creep.travelTo(controller, {ignoreCreeps: false,range:1});
                        }
                    }
                    else
                        throw "claimer in room "+targetRoom+" but can't see controller";
                }
            }
        }
        catch (problem) {
            console.log('claimer threw error: '+problem);
        }
    }
};

module.exports = roleClaimer;