var roleClaimer = {

    /** @param {Creep} creep **/
    run: function(creep) {
        try {
            var targetRoom = creep.memory.targetRoom;
            if(targetRoom) {
                var controller = Game.getObjectById(Game.rooms[targetRoom].controller.id);
                if(targetRoom != creep.room.name) {
                    var result;
                    if(controller)
                        result = creep.travelTo(controller);
                    else
                        result = creep.travelTo(new RoomPosition(25,25,targetRoom),{swampCost:1,range:1});
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