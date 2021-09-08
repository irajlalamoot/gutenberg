/**
 * External dependencies
 */
import { invert, omit } from 'lodash';

/**
 * WordPress dependencies
 */
import { __, sprintf } from '@wordpress/i18n';
import { store as noticesStore } from '@wordpress/notices';
import { serialize } from '@wordpress/blocks';
import apiFetch from '@wordpress/api-fetch';

/**
 * Internal dependencies
 */
import { STORE_NAME } from './constants';
import { NAVIGATION_POST_KIND, NAVIGATION_POST_POST_TYPE } from '../constants';
import { menuItemsQuery, blockAttributesToMenuItem } from './utils';

/**
 * Returns an action object used to select menu.
 *
 * @param {number} menuId The menu ID.
 * @return {Object} Action object.
 */
export function setSelectedMenuId( menuId ) {
	return {
		type: 'SET_SELECTED_MENU_ID',
		menuId,
	};
}

/**
 * Creates a menu item for every block that doesn't have an associated menuItem.
 * Requests POST /wp/v2/menu-items once for every menu item created.
 *
 * @param {Object} post A navigation post to process
 * @return {Function} An action creator
 */
export const createMissingMenuItems = ( post ) => async ( {
	dispatch,
	registry,
} ) => {
	const menuId = post.meta.menuId;
	// @TODO: extract locks to a separate package?
	const lock = await registry
		.dispatch( 'core' )
		.__unstableAcquireStoreLock( STORE_NAME, [ 'savingMenu' ], {
			exclusive: false,
		} );
	try {
		const mapping = await getEntityRecordToBlockIdMapping(
			registry,
			post.id
		);
		const clientIdToMenuId = invert( mapping );

		const stack = [ post.blocks[ 0 ] ];
		while ( stack.length ) {
			const block = stack.pop();
			if ( ! ( block.clientId in clientIdToMenuId ) ) {
				const menuItem = await apiFetch( {
					path: `/__experimental/menu-items`,
					method: 'POST',
					data: {
						title: 'Placeholder',
						url: 'Placeholder',
						menu_order: 0,
					},
				} );

				mapping[ menuItem.id ] = block.clientId;
				const menuItems = await registry
					.resolveSelect( 'core' )
					.getMenuItems( { menus: menuId, per_page: -1 } );

				await registry
					.dispatch( 'core' )
					.receiveEntityRecords(
						'root',
						'menuItem',
						[ ...menuItems, menuItem ],
						menuItemsQuery( menuId ),
						false
					);
			}
			stack.push( ...block.innerBlocks );
		}

		dispatch( {
			type: 'SET_MENU_ITEM_TO_CLIENT_ID_MAPPING',
			postId: post.id,
			mapping,
		} );
	} finally {
		await registry.dispatch( 'core' ).__unstableReleaseStoreLock( lock );
	}
};

/**
 * Converts all the blocks into menu items and submits a batch request to save everything at once.
 *
 * @param {Object} post A navigation post to process
 * @return {Function} An action creator
 */
export const saveNavigationPost = ( post ) => async ( {
	registry,
	dispatch,
} ) => {
	const lock = await registry
		.dispatch( 'core' )
		.__unstableAcquireStoreLock( STORE_NAME, [ 'savingMenu' ], {
			exclusive: true,
		} );
	try {
		const menuId = post.meta.menuId;

		await registry
			.dispatch( 'core' )
			.saveEditedEntityRecord( 'root', 'menu', menuId );

		const error = registry
			.select( 'core' )
			.getLastEntitySaveError( 'root', 'menu', menuId );

		if ( error ) {
			throw new Error( error.message );
		}

		// Save blocks as menu items.
		const batchTasks = await dispatch(
			createBatchSaveForEditedMenuItems( post )
		);
		await registry.dispatch( 'core' ).__experimentalBatch( batchTasks );

		// Clear "stub" navigation post edits to avoid a false "dirty" state.
		await registry
			.dispatch( 'core' )
			.receiveEntityRecords(
				NAVIGATION_POST_KIND,
				NAVIGATION_POST_POST_TYPE,
				[ post ],
				undefined
			);

		await registry
			.dispatch( noticesStore )
			.createSuccessNotice( __( 'Navigation saved.' ), {
				type: 'snackbar',
			} );
	} catch ( saveError ) {
		const errorMessage = saveError
			? sprintf(
					/* translators: %s: The text of an error message (potentially untranslated). */
					__( "Unable to save: '%s'" ),
					saveError.message
			  )
			: __( 'Unable to save: An error o1curred.' );
		await registry
			.dispatch( noticesStore )
			.createErrorNotice( errorMessage, {
				type: 'snackbar',
			} );
	} finally {
		await registry.dispatch( 'core' ).__unstableReleaseStoreLock( lock );
	}
};

const getEntityRecordToBlockIdMapping = ( registry, postId ) =>
	registry.stores[ STORE_NAME ].store.getState().mapping[ postId ] || {};

function mapBlockIdToEntityRecord( entityIdToBlockId, entityRecords ) {
	return Object.fromEntries(
		entityRecords
			.map( ( entityRecord ) => [
				entityIdToBlockId[ entityRecord.id ],
				entityRecord,
			] )
			.filter( ( [ blockId ] ) => blockId )
	);
}

// saveEntityRecord for each menu item with block-based data
// saveEntityRecord for each deleted menu item
const createBatchSaveForEditedMenuItems = ( post ) => async ( {
	registry,
} ) => {
	const navigationBlock = post.blocks[ 0 ];
	const menuId = post.meta.menuId;
	const menuItems = await registry
		.resolveSelect( 'core' )
		.getMenuItems( { menus: menuId, per_page: -1 } );

	const blockIdToAPIEntity = mapBlockIdToEntityRecord(
		getEntityRecordToBlockIdMapping( registry, post.id ),
		menuItems
	);

	const blocksList = blocksTreeToFlatList( navigationBlock.innerBlocks );

	const deletedEntityRecordsIds = computeDeletedEntityRecordsIds(
		blockIdToAPIEntity,
		blocksList
	);

	const batchTasks = [];
	// Enqueue updates
	for ( const { block, parentBlockId, position } of blocksList ) {
		const entityRecordId = blockIdToAPIEntity[ block.clientId ]?.id;
		if (
			! entityRecordId ||
			deletedEntityRecordsIds.includes( entityRecordId )
		) {
			continue;
		}

		// Update an existing navigation item.
		await registry
			.dispatch( 'core' )
			.editEntityRecord(
				'root',
				'menuItem',
				entityRecordId,
				blockToMenuItem(
					block,
					blockIdToAPIEntity[ block.clientId ],
					blockIdToAPIEntity[ parentBlockId ]?.id,
					position,
					menuId
				),
				{ undoIgnore: true }
			);

		const hasEdits = registry
			.select( 'core' )
			.hasEditsForEntityRecord( 'root', 'menuItem', entityRecordId );

		if ( ! hasEdits ) {
			continue;
		}

		batchTasks.unshift( ( { saveEditedEntityRecord } ) =>
			saveEditedEntityRecord( 'root', 'menuItem', entityRecordId )
		);
	}

	// Enqueue deletes
	for ( const entityRecordId of deletedEntityRecordsIds ) {
		batchTasks.unshift( ( { deleteEntityRecord } ) =>
			deleteEntityRecord( 'root', 'menuItem', entityRecordId, {
				force: true,
			} )
		);
	}

	return batchTasks;
};

function blockToMenuItem( block, menuItem, parentId, position, menuId ) {
	menuItem = omit( menuItem, 'menus', 'meta', '_links' );

	let attributes;

	if ( block.name === 'core/navigation-link' ) {
		attributes = blockAttributesToMenuItem( block.attributes );
	} else {
		attributes = {
			type: 'block',
			content: serialize( block ),
		};
	}

	return {
		...menuItem,
		...attributes,
		menu_order: position,
		menu_id: menuId,
		parent: parentId,
		status: 'publish',
		_invalid: false,
	};
}

function blocksTreeToFlatList( innerBlocks, parentBlockId = null ) {
	return innerBlocks.flatMap( ( block, index ) =>
		[ { block, parentBlockId, position: index + 1 } ].concat(
			blocksTreeToFlatList( block.innerBlocks, block.clientId )
		)
	);
}

function computeDeletedEntityRecordsIds( blockIdToAPIEntity, blocksList ) {
	const editorBlocksIds = new Set(
		blocksList.map( ( { block } ) => block.clientId )
	);
	return Object.entries( blockIdToAPIEntity )
		.filter( ( [ clientId ] ) => ! editorBlocksIds.has( clientId ) )
		.map( ( [ , entityRecord ] ) => entityRecord.id );
}
