
var spawner = require('spawner');

/**
 * Utility and common functions regarding base management
 */
var baseCommon = {

    //Caching of tick-scope static data
    ownedRooms: [],

    /**
     * Cycle through spawns to get rooms with owned controllers
     * @return {Array} roomArray
     */
    getOwnedRooms:function() {
        if( this.ownedRooms.length > 0)
            return this.ownedRooms;

        let rooms = {}; //forces unique keys so don't have to write logic for duplicates
        for( i in Game.spawns ) {
            rooms[Game.spawns[i].room.name] = true;
        }
        this.ownedRooms = [];
        for( n in rooms ) {
            this.ownedRooms.push(n);
        }

        return this.ownedRooms;
    },

    /**
     * Remove old creep data and enact default behaviour when that happens which is spawning lost creep for now
     */
    garbageCollection:function() {
        try {
            for(var creepName in Memory.creeps) {
                if(!Game.creeps[creepName]) {
                    if(!Memory.creeps[creepName].norespawn && !(Memory.creeps[creepName].role == "breaker" || Memory.creeps[creepName].role == "attacker") )
                        spawner.queueSpawn({memory:Memory.creeps[creepName]})
                    delete Memory.creeps[creepName];
                }
            }
        }
        catch( problem ) {
            console.log(`Exception base.comon garbage collection: ${problem.name}: ${problem.message} ${problem.stack}  `);
        }
    }
}

module.exports = baseCommon;