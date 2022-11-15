var diplomacy = {

    initDiploDB: () => {

        if( !Memory.diplomacy ) {
            Memory.diplomacy = {};
        }

        if( !Memory.diplomacy.allies ) {
            Memory.diplomacy.allies = [];
        }
    },

    isAlly: ( ownerName ) => {
        this.initDiploDB;

        let allyList = Memory.diplomacy.allies;
        if( _.includes(Memory.diplomacy.allies, ownerName) ) {
            return true;
        }

        return false;
    }

}

module.exports = diplomacy;